const dbPool = require('../db');

const LINKED_TRANSACTION_PREFIX = 'Linked transaction ID:';

const formatIsoDate = (value) => {
    if (!value) {
        return null;
    }
    return new Date(value).toISOString().split('T')[0];
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return NaN;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : NaN;
};

const parseCsvRow = (rowText) => {
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let index = 0; index < rowText.length; index += 1) {
        const character = rowText[index];

        if (character === '"') {
            if (inQuotes && rowText[index + 1] === '"') {
                currentValue += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (character === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += character;
        }
    }

    values.push(currentValue.trim());
    return values;
};

const buildTransactionFilters = (queryParams) => {
    const {
        startDate,
        endDate,
        categoryId,
        type,
        minAmount,
        maxAmount,
        search
    } = queryParams;

    const whereConditions = [];
    const queryValues = [];

    if (startDate) {
        whereConditions.push('t.transaction_date >= ?');
        queryValues.push(startDate);
    }
    if (endDate) {
        whereConditions.push('t.transaction_date <= ?');
        queryValues.push(endDate);
    }
    if (categoryId && Number.isInteger(Number(categoryId))) {
        whereConditions.push('t.category_id = ?');
        queryValues.push(Number(categoryId));
    }
    if (type === 'income' || type === 'expense') {
        whereConditions.push('c.type = ?');
        queryValues.push(type);
    }
    if (!Number.isNaN(toNumber(minAmount))) {
        whereConditions.push('t.amount >= ?');
        queryValues.push(toNumber(minAmount));
    }
    if (!Number.isNaN(toNumber(maxAmount))) {
        whereConditions.push('t.amount <= ?');
        queryValues.push(toNumber(maxAmount));
    }
    if (search && search.trim()) {
        whereConditions.push('(t.description LIKE ? OR c.name LIKE ?)');
        queryValues.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    return {
        whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '',
        queryValues,
    };
};

const ensureRecurringTable = async (connection) => {
    const queryExecutor = connection || dbPool;
    await queryExecutor.query(`
        CREATE TABLE IF NOT EXISTS recurring_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            description VARCHAR(255) NULL,
            amount DECIMAL(12,2) NOT NULL,
            category_id INT NOT NULL,
            interval_type ENUM('weekly', 'monthly') NOT NULL,
            day_of_week TINYINT NULL,
            day_of_month TINYINT NULL,
            start_date DATE NOT NULL,
            last_processed_date DATE NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_recurring_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
    `);
};

const addDays = (dateValue, dayCount) => {
    const updatedDate = new Date(dateValue);
    updatedDate.setDate(updatedDate.getDate() + dayCount);
    return updatedDate;
};

const addMonths = (dateValue, monthCount, preferredDay = null) => {
    const updatedDate = new Date(dateValue);
    const targetDay = preferredDay || updatedDate.getDate();
    updatedDate.setDate(1);
    updatedDate.setMonth(updatedDate.getMonth() + monthCount);
    const finalDayOfMonth = new Date(updatedDate.getFullYear(), updatedDate.getMonth() + 1, 0).getDate();
    updatedDate.setDate(Math.min(targetDay, finalDayOfMonth));
    return updatedDate;
};

const getNextDueDate = (rule) => {
    if (!rule.last_processed_date) {
        return new Date(rule.start_date);
    }

    const lastProcessedDate = new Date(rule.last_processed_date);
    if (rule.interval_type === 'weekly') {
        return addDays(lastProcessedDate, 7);
    }

    return addMonths(lastProcessedDate, 1, rule.day_of_month || new Date(rule.start_date).getDate());
};

const runRecurringProcessor = async (connection) => {
    await ensureRecurringTable(connection);

    const [rules] = await connection.query(`
        SELECT *
        FROM recurring_transactions
        WHERE is_active = TRUE;
    `);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let createdTransactionCount = 0;

    for (const rule of rules) {
        let dueDate = getNextDueDate(rule);
        dueDate.setHours(0, 0, 0, 0);

        let latestProcessedDate = null;
        let safetyCounter = 0;

        while (dueDate <= today && safetyCounter < 120) {
            await connection.query(
                'INSERT INTO transactions (description, amount, transaction_date, category_id) VALUES (?, ?, ?, ?)',
                [rule.description || null, Number(rule.amount), formatIsoDate(dueDate), rule.category_id]
            );

            latestProcessedDate = formatIsoDate(dueDate);
            createdTransactionCount += 1;
            safetyCounter += 1;

            dueDate = rule.interval_type === 'weekly'
                ? addDays(dueDate, 7)
                : addMonths(dueDate, 1, rule.day_of_month || dueDate.getDate());
        }

        if (latestProcessedDate) {
            await connection.query(
                'UPDATE recurring_transactions SET last_processed_date = ? WHERE id = ?',
                [latestProcessedDate, rule.id]
            );
        }
    }

    return createdTransactionCount;
};

const addTransaction = async (req, res) => {
    const { description, amount, transaction_date, category_id, goalIdToContribute = null } = req.body;

  if (amount === undefined || typeof amount !== 'number' || !transaction_date || !category_id) {
      return res.status(400).json({ message: 'Missing/invalid fields (amount, date, category).' });
  }

  const parsedAmount = parseFloat(amount.toFixed(2));
  const parsedCategoryId = parseInt(category_id, 10);

  const parsedGoalId = goalIdToContribute ? parseInt(goalIdToContribute, 10) : null;
  if (goalIdToContribute && isNaN(parsedGoalId)) {
       return res.status(400).json({ message: 'Invalid Goal ID provided for contribution.' });
  }

  let connection;
  try {
      connection = await dbPool.getConnection();
      await connection.beginTransaction();

      const transactionInsertQuery = `
          INSERT INTO transactions (description, amount, transaction_date, category_id)
          VALUES (?, ?, ?, ?)
      `;

      const transactionValues = [description, parsedAmount, transaction_date, parsedCategoryId];
      const [transactionResult] = await connection.query(transactionInsertQuery, transactionValues);
      const newTransactionId = transactionResult.insertId;

      let updatedGoal = null;
      if (parsedGoalId && parsedAmount > 0) {
           const contributionInsertQuery = `
               INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
               VALUES (?, ?, ?, ?);
           `;

           const contributionNotes = `Linked transaction ID: ${newTransactionId}`;
           await connection.query(contributionInsertQuery, [parsedGoalId, parsedAmount, transaction_date, contributionNotes]);

           const goalUpdateQuery = `
               UPDATE goals
               SET current_amount = current_amount + ?
               WHERE id = ?;
           `;
           const [goalUpdateResult] = await connection.query(goalUpdateQuery, [parsedAmount, parsedGoalId]);

           if (goalUpdateResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Goal with ID ${parsedGoalId} not found. Transaction not saved.` });
           }

           const [updatedGoalRows] = await connection.query('SELECT * FROM goals WHERE id = ?', [parsedGoalId]);
            updatedGoal = updatedGoalRows[0] ? {
               ...updatedGoalRows[0],
               target_amount: parseFloat(updatedGoalRows[0].target_amount),
               current_amount: parseFloat(updatedGoalRows[0].current_amount),
               target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null,
            } : null;
      }

      await connection.commit();

      res.status(201).json({
          message: 'Transaction added successfully!',
          transactionId: newTransactionId,
          updatedGoal,
      });

  } catch (error) {
      console.error('Error adding transaction (with potential contribution):', error);
      if (connection) {
          await connection.rollback();
      }

       if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('transactions_ibfk_1')) {
            return res.status(404).json({ message: `Category with ID ${parsedCategoryId} not found.` });
       }

      res.status(500).json({ message: 'Failed to add transaction due to server error.' });
  } finally {
      if (connection) {
          connection.release();
      }
  }
};

const getAllTransactions = async (req, res) => {
    let connection;
  try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        await runRecurringProcessor(connection);

        const { whereClause, queryValues } = buildTransactionFilters(req.query);

        const query = `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.transaction_date,
        t.category_id,
        t.created_at,
        c.name AS category_name
      FROM
        transactions t
      LEFT JOIN
        categories c ON t.category_id = c.id
            ${whereClause}
      ORDER BY
                t.transaction_date DESC, t.created_at DESC
            LIMIT 1000;
    `;

        const [transactions] = await connection.query(query, queryValues);
        await connection.commit();

    const formattedTransactions = transactions.map((transaction) => ({
        ...transaction,
        transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
    }));

    res.json(formattedTransactions);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    if (connection) {
        await connection.rollback();
    }
    res.status(500).json({ message: 'Failed to fetch transactions' });
  } finally {
    if (connection) {
        connection.release();
    }
  }
};

const updateTransaction = async (req, res) => {
    const transactionId = Number(req.params.id);
    if (!Number.isInteger(transactionId)) {
        return res.status(400).json({ message: 'Invalid transaction ID.' });
    }

    const {
        description,
        amount,
        transaction_date: transactionDate,
        category_id: categoryId,
        goalIdToContribute = null
    } = req.body;

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
        if (existingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        const existingTransaction = existingRows[0];
        const updatedAmount = amount === undefined ? Number(existingTransaction.amount) : toNumber(amount);
        const updatedCategoryId = categoryId === undefined ? existingTransaction.category_id : Number(categoryId);
        const updatedDate = transactionDate || formatIsoDate(existingTransaction.transaction_date);
        const updatedDescription = description === undefined ? existingTransaction.description : description;

        if (Number.isNaN(updatedAmount) || !updatedDate || !Number.isInteger(updatedCategoryId)) {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid transaction payload.' });
        }

        await connection.query(
            'UPDATE transactions SET description = ?, amount = ?, transaction_date = ?, category_id = ? WHERE id = ?',
            [updatedDescription || null, Number(updatedAmount.toFixed(2)), updatedDate, updatedCategoryId, transactionId]
        );

        const contributionLinkText = `${LINKED_TRANSACTION_PREFIX} ${transactionId}`;
        const [linkedContributionRows] = await connection.query(
            'SELECT id, goal_id, amount FROM goal_contributions WHERE notes = ?',
            [contributionLinkText]
        );

        const linkedContribution = linkedContributionRows[0] || null;

        if (linkedContribution) {
            const previousContributionAmount = Number(linkedContribution.amount);
            if (updatedAmount > 0) {
                const differenceAmount = Number(updatedAmount.toFixed(2)) - previousContributionAmount;
                await connection.query(
                    'UPDATE goal_contributions SET amount = ?, contribution_date = ? WHERE id = ?',
                    [Number(updatedAmount.toFixed(2)), updatedDate, linkedContribution.id]
                );
                if (differenceAmount !== 0) {
                    await connection.query(
                        'UPDATE goals SET current_amount = current_amount + ? WHERE id = ?',
                        [differenceAmount, linkedContribution.goal_id]
                    );
                }
            } else {
                await connection.query('UPDATE goals SET current_amount = current_amount - ? WHERE id = ?', [previousContributionAmount, linkedContribution.goal_id]);
                await connection.query('DELETE FROM goal_contributions WHERE id = ?', [linkedContribution.id]);
            }
        } else if (goalIdToContribute && updatedAmount > 0) {
            const parsedGoalId = Number(goalIdToContribute);
            if (Number.isInteger(parsedGoalId)) {
                await connection.query(
                    'INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes) VALUES (?, ?, ?, ?)',
                    [parsedGoalId, Number(updatedAmount.toFixed(2)), updatedDate, contributionLinkText]
                );
                await connection.query('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?', [Number(updatedAmount.toFixed(2)), parsedGoalId]);
            }
        }

        await connection.commit();
        res.status(200).json({ message: 'Transaction updated successfully.' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to update transaction due to server error.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getTransactionInsights = async (req, res) => {
    const monthsBack = Number(req.query.months) || 12;
    const boundedMonths = Math.min(Math.max(monthsBack, 1), 36);

    try {
        const [monthlyRows] = await dbPool.query(
            `
            SELECT
                DATE_FORMAT(t.transaction_date, '%Y-%m') AS period,
                SUM(CASE WHEN c.type = 'income' THEN t.amount ELSE 0 END) AS income_total,
                SUM(CASE WHEN c.type = 'expense' THEN t.amount ELSE 0 END) AS expense_total
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
            GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
            ORDER BY period ASC;
            `,
            [boundedMonths]
        );

        const [topCategoryRows] = await dbPool.query(
            `
            SELECT
                c.name,
                c.type,
                SUM(t.amount) AS total_amount
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
            GROUP BY c.name, c.type
            ORDER BY total_amount DESC
            LIMIT 8;
            `,
            [boundedMonths]
        );

        res.json({
            months: boundedMonths,
            monthly: monthlyRows.map((row) => ({
                period: row.period,
                income_total: Number(row.income_total || 0),
                expense_total: Number(row.expense_total || 0),
                net_total: Number(row.income_total || 0) - Number(row.expense_total || 0)
            })),
            topCategories: topCategoryRows.map((row) => ({
                name: row.name || 'Uncategorised',
                type: row.type || 'unknown',
                total_amount: Number(row.total_amount || 0)
            }))
        });
    } catch (error) {
        console.error('Error fetching transaction insights:', error);
        res.status(500).json({ message: 'Failed to fetch insights.' });
    }
};

const exportTransactionsCsv = async (req, res) => {
    try {
        const { whereClause, queryValues } = buildTransactionFilters(req.query);
        const [rows] = await dbPool.query(
            `
            SELECT
                t.id,
                t.transaction_date,
                t.description,
                t.amount,
                t.category_id,
                c.name AS category_name,
                c.type AS category_type
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            ${whereClause}
            ORDER BY t.transaction_date DESC, t.id DESC
            LIMIT 5000;
            `,
            queryValues
        );

        const headerRow = ['id', 'transaction_date', 'description', 'amount', 'category_id', 'category_name', 'category_type'];
        const csvRows = rows.map((row) => [
            row.id,
            formatIsoDate(row.transaction_date),
            `"${(row.description || '').replace(/"/g, '""')}"`,
            Number(row.amount || 0).toFixed(2),
            row.category_id || '',
            `"${(row.category_name || '').replace(/"/g, '""')}"`,
            row.category_type || ''
        ].join(','));

        const csvContent = [headerRow.join(','), ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions-export.csv"');
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ message: 'Failed to export CSV.' });
    }
};

const importTransactionsCsv = async (req, res) => {
    const { csvText } = req.body;

    if (!csvText || typeof csvText !== 'string') {
        return res.status(400).json({ message: 'csvText is required.' });
    }

    const rows = csvText.split(/\r?\n/).filter((row) => row.trim() !== '');
    if (rows.length < 2) {
        return res.status(400).json({ message: 'CSV must include a header row and at least one data row.' });
    }

    const headers = parseCsvRow(rows[0]).map((header) => header.toLowerCase());
    const descriptionIndex = headers.indexOf('description');
    const amountIndex = headers.indexOf('amount');
    const dateIndex = headers.indexOf('transaction_date');
    const categoryIdIndex = headers.indexOf('category_id');
    const categoryNameIndex = headers.indexOf('category_name');

    if (amountIndex === -1 || dateIndex === -1 || (categoryIdIndex === -1 && categoryNameIndex === -1)) {
        return res.status(400).json({ message: 'CSV header must include amount, transaction_date, and category_id or category_name.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [categoryRows] = await connection.query('SELECT id, name FROM categories');
        const categoryByName = new Map(categoryRows.map((row) => [String(row.name).toLowerCase(), row.id]));

        let importedCount = 0;
        let skippedCount = 0;

        for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
            const rowValues = parseCsvRow(rows[rowIndex]);
            const parsedAmount = toNumber(rowValues[amountIndex]);
            const parsedDate = rowValues[dateIndex];
            const parsedDescription = descriptionIndex === -1 ? null : (rowValues[descriptionIndex] || null);

            let parsedCategoryId = Number(rowValues[categoryIdIndex]);
            if (!Number.isInteger(parsedCategoryId) && categoryNameIndex !== -1) {
                const nameKey = String(rowValues[categoryNameIndex] || '').toLowerCase();
                parsedCategoryId = categoryByName.get(nameKey);
            }

            if (Number.isNaN(parsedAmount) || !parsedDate || !Number.isInteger(parsedCategoryId)) {
                skippedCount += 1;
                continue;
            }

            await connection.query(
                'INSERT INTO transactions (description, amount, transaction_date, category_id) VALUES (?, ?, ?, ?)',
                [parsedDescription, Number(parsedAmount.toFixed(2)), parsedDate, parsedCategoryId]
            );
            importedCount += 1;
        }

        await connection.commit();

        res.status(200).json({
            message: 'CSV import completed.',
            importedCount,
            skippedCount,
        });
    } catch (error) {
        console.error('Error importing CSV:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to import CSV.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getRecurringTransactions = async (req, res) => {
    try {
        await ensureRecurringTable();
        const [rows] = await dbPool.query(`
            SELECT rt.*, c.name AS category_name
            FROM recurring_transactions rt
            LEFT JOIN categories c ON c.id = rt.category_id
            ORDER BY rt.created_at DESC;
        `);

        res.json(rows.map((row) => ({
            ...row,
            amount: Number(row.amount),
            start_date: formatIsoDate(row.start_date),
            last_processed_date: formatIsoDate(row.last_processed_date),
        })));
    } catch (error) {
        console.error('Error fetching recurring transactions:', error);
        res.status(500).json({ message: 'Failed to fetch recurring transactions.' });
    }
};

const createRecurringTransaction = async (req, res) => {
    const {
        description = null,
        amount,
        category_id: categoryId,
        interval_type: intervalType,
        day_of_week: dayOfWeek = null,
        day_of_month: dayOfMonth = null,
        start_date: startDate,
        is_active: isActive = true,
    } = req.body;

    const parsedAmount = toNumber(amount);
    const parsedCategoryId = Number(categoryId);

    if (Number.isNaN(parsedAmount) || !Number.isInteger(parsedCategoryId) || !startDate || !['weekly', 'monthly'].includes(intervalType)) {
        return res.status(400).json({ message: 'Invalid recurring transaction payload.' });
    }

    try {
        await ensureRecurringTable();
        const [result] = await dbPool.query(
            `
            INSERT INTO recurring_transactions
            (description, amount, category_id, interval_type, day_of_week, day_of_month, start_date, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                description,
                Number(parsedAmount.toFixed(2)),
                parsedCategoryId,
                intervalType,
                dayOfWeek,
                dayOfMonth,
                startDate,
                Boolean(isActive)
            ]
        );
        res.status(201).json({ message: 'Recurring transaction created.', id: result.insertId });
    } catch (error) {
        console.error('Error creating recurring transaction:', error);
        res.status(500).json({ message: 'Failed to create recurring transaction.' });
    }
};

const updateRecurringTransaction = async (req, res) => {
    const recurringId = Number(req.params.id);
    if (!Number.isInteger(recurringId)) {
        return res.status(400).json({ message: 'Invalid recurring transaction ID.' });
    }

    const {
        description = null,
        amount,
        category_id: categoryId,
        interval_type: intervalType,
        day_of_week: dayOfWeek = null,
        day_of_month: dayOfMonth = null,
        start_date: startDate,
        is_active: isActive = true,
    } = req.body;

    const parsedAmount = toNumber(amount);
    const parsedCategoryId = Number(categoryId);

    if (Number.isNaN(parsedAmount) || !Number.isInteger(parsedCategoryId) || !startDate || !['weekly', 'monthly'].includes(intervalType)) {
        return res.status(400).json({ message: 'Invalid recurring transaction payload.' });
    }

    try {
        await ensureRecurringTable();
        const [result] = await dbPool.query(
            `
            UPDATE recurring_transactions
            SET description = ?, amount = ?, category_id = ?, interval_type = ?, day_of_week = ?, day_of_month = ?, start_date = ?, is_active = ?
            WHERE id = ?
            `,
            [description, Number(parsedAmount.toFixed(2)), parsedCategoryId, intervalType, dayOfWeek, dayOfMonth, startDate, Boolean(isActive), recurringId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Recurring transaction not found.' });
        }

        res.status(200).json({ message: 'Recurring transaction updated.' });
    } catch (error) {
        console.error('Error updating recurring transaction:', error);
        res.status(500).json({ message: 'Failed to update recurring transaction.' });
    }
};

const deleteRecurringTransaction = async (req, res) => {
    const recurringId = Number(req.params.id);
    if (!Number.isInteger(recurringId)) {
        return res.status(400).json({ message: 'Invalid recurring transaction ID.' });
    }

    try {
        await ensureRecurringTable();
        const [result] = await dbPool.query('DELETE FROM recurring_transactions WHERE id = ?', [recurringId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Recurring transaction not found.' });
        }
        res.status(200).json({ message: 'Recurring transaction deleted.' });
    } catch (error) {
        console.error('Error deleting recurring transaction:', error);
        res.status(500).json({ message: 'Failed to delete recurring transaction.' });
    }
};

const processRecurringTransactions = async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const createdTransactionCount = await runRecurringProcessor(connection);
        await connection.commit();

        res.status(200).json({
            message: 'Recurring transactions processed successfully.',
            createdTransactionCount,
        });
    } catch (error) {
        console.error('Error processing recurring transactions:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to process recurring transactions.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const deleteTransaction = async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({ message: 'Invalid transaction ID.' });
    }
    const transactionId = parseInt(id, 10);

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const contributionLinkText = `${LINKED_TRANSACTION_PREFIX} ${transactionId}`;
        const findContributionQuery = 'SELECT id, goal_id, amount FROM goal_contributions WHERE notes = ?';
        const [contributionRows] = await connection.query(findContributionQuery, [contributionLinkText]);

        if (contributionRows.length > 0) {
            const contribution = contributionRows[0];
            const amountToReverse = parseFloat(contribution.amount);

            const updateGoalQuery = 'UPDATE goals SET current_amount = current_amount - ? WHERE id = ?';
            await connection.query(updateGoalQuery, [amountToReverse, contribution.goal_id]);

            const deleteContributionQuery = 'DELETE FROM goal_contributions WHERE id = ?';
            await connection.query(deleteContributionQuery, [contribution.id]);
        }

        const deleteTransactionQuery = 'DELETE FROM transactions WHERE id = ?';
        const [result] = await connection.query(deleteTransactionQuery, [transactionId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        await connection.commit();

        res.status(200).json({ message: `Transaction with ID ${transactionId} deleted successfully.` });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to delete transaction due to server error.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
  addTransaction,
  getAllTransactions,
    updateTransaction,
  deleteTransaction,
    getTransactionInsights,
    exportTransactionsCsv,
    importTransactionsCsv,
    getRecurringTransactions,
    createRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    processRecurringTransactions,
};