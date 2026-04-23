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

const ensurePlannedTransactionsTable = async (connection) => {
    const queryExecutor = connection || dbPool;
    await queryExecutor.query(`
        CREATE TABLE IF NOT EXISTS planned_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            description VARCHAR(255) NULL,
            amount DECIMAL(12,2) NOT NULL,
            category_id INT NOT NULL,
            frequency ENUM('one_time', 'weekly', 'monthly') NOT NULL DEFAULT 'one_time',
            planned_date DATE NULL,
            start_date DATE NULL,
            end_date DATE NULL,
            day_of_week TINYINT NULL,
            day_of_month TINYINT NULL,
            scenario VARCHAR(64) NOT NULL DEFAULT 'base',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            notes VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_planned_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            INDEX idx_planned_scenario_active (scenario, is_active),
            INDEX idx_planned_dates (planned_date, start_date, end_date),
            INDEX idx_planned_category (category_id)
        );
    `);
};

const toDateOnlyString = (value) => {
    if (!value) {
        return null;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }
    return parsedDate.toISOString().split('T')[0];
};

const getMonthKey = (value) => {
    const dateValue = new Date(value);
    return `${dateValue.getUTCFullYear()}-${String(dateValue.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (startMonth, monthsAhead) => {
    const [yearPart, monthPart] = String(startMonth).split('-').map(Number);
    const startDate = new Date(Date.UTC(yearPart, monthPart - 1, 1));
    const periods = [];
    for (let index = 0; index < monthsAhead; index += 1) {
        const periodDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index, 1));
        periods.push(getMonthKey(periodDate));
    }

    const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + monthsAhead, 0));
    return {
        periods,
        startDate,
        endDate,
    };
};

const normalisePlannedTransaction = (row) => ({
    ...row,
    amount: Number(row.amount || 0),
    planned_date: toDateOnlyString(row.planned_date),
    start_date: toDateOnlyString(row.start_date),
    end_date: toDateOnlyString(row.end_date),
});

const validatePlannedTransactionPayload = (payload) => {
    const parsedAmount = toNumber(payload.amount);
    const parsedCategoryId = Number(payload.category_id);
    const frequency = payload.frequency || 'one_time';
    const plannedDate = toDateOnlyString(payload.planned_date);
    const startDate = toDateOnlyString(payload.start_date);
    const endDate = toDateOnlyString(payload.end_date);
    const dayOfWeek = payload.day_of_week === null || payload.day_of_week === undefined || payload.day_of_week === ''
        ? null
        : Number(payload.day_of_week);
    const dayOfMonth = payload.day_of_month === null || payload.day_of_month === undefined || payload.day_of_month === ''
        ? null
        : Number(payload.day_of_month);
    const scenario = payload.scenario && String(payload.scenario).trim() ? String(payload.scenario).trim() : 'base';

    if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedCategoryId)) {
        return { isValid: false, message: 'Invalid amount or category.' };
    }

    if (!['one_time', 'weekly', 'monthly'].includes(frequency)) {
        return { isValid: false, message: 'frequency must be one_time, weekly, or monthly.' };
    }

    if (frequency === 'one_time' && !plannedDate) {
        return { isValid: false, message: 'planned_date is required for one_time frequency.' };
    }

    if (frequency !== 'one_time' && !startDate) {
        return { isValid: false, message: 'start_date is required for recurring planned transactions.' };
    }

    if (frequency === 'weekly') {
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return { isValid: false, message: 'day_of_week must be an integer between 0 and 6.' };
        }
    }

    if (frequency === 'monthly') {
        if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
            return { isValid: false, message: 'day_of_month must be an integer between 1 and 31.' };
        }
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        return { isValid: false, message: 'end_date cannot be before start_date.' };
    }

    return {
        isValid: true,
        values: {
            description: payload.description || null,
            amount: Number(parsedAmount.toFixed(2)),
            category_id: parsedCategoryId,
            frequency,
            planned_date: frequency === 'one_time' ? plannedDate : null,
            start_date: frequency === 'one_time' ? null : startDate,
            end_date: frequency === 'one_time' ? null : endDate,
            day_of_week: frequency === 'weekly' ? dayOfWeek : null,
            day_of_month: frequency === 'monthly' ? dayOfMonth : null,
            scenario,
            is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
            notes: payload.notes || null,
        }
    };
};

const addPlannedImpact = (impactByPeriod, period, categoryType, amount) => {
    if (!impactByPeriod.has(period)) {
        impactByPeriod.set(period, { income: 0, expense: 0 });
    }

    const existingPeriod = impactByPeriod.get(period);
    if (categoryType === 'income') {
        existingPeriod.income += Number(amount || 0);
    } else {
        existingPeriod.expense += Number(amount || 0);
    }
};

const getNextWeeklyDate = (baseDate, targetDayOfWeek) => {
    const dateValue = new Date(baseDate);
    const offset = (targetDayOfWeek - dateValue.getDay() + 7) % 7;
    dateValue.setDate(dateValue.getDate() + offset);
    return dateValue;
};

const getNextMonthlyDate = (baseDate, preferredDay) => {
    const dateValue = new Date(baseDate);
    const daysInCurrentMonth = new Date(dateValue.getFullYear(), dateValue.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(preferredDay, daysInCurrentMonth);
    dateValue.setDate(targetDay);

    if (dateValue < baseDate) {
        return addMonths(dateValue, 1, preferredDay);
    }

    return dateValue;
};

const appendPlannedOccurrences = (rule, horizonStartDate, horizonEndDate, impactByPeriod) => {
    if (!rule.is_active) {
        return;
    }

    const categoryType = rule.category_type === 'income' ? 'income' : 'expense';

    if (rule.frequency === 'one_time') {
        if (!rule.planned_date) {
            return;
        }

        const plannedDate = new Date(rule.planned_date);
        if (plannedDate >= horizonStartDate && plannedDate <= horizonEndDate) {
            addPlannedImpact(impactByPeriod, getMonthKey(plannedDate), categoryType, rule.amount);
        }
        return;
    }

    const startDate = rule.start_date ? new Date(rule.start_date) : null;
    if (!startDate) {
        return;
    }

    const effectiveStartDate = startDate > horizonStartDate ? startDate : horizonStartDate;
    const endDate = rule.end_date ? new Date(rule.end_date) : null;
    const effectiveEndDate = endDate && endDate < horizonEndDate ? endDate : horizonEndDate;

    if (effectiveEndDate < effectiveStartDate) {
        return;
    }

    if (rule.frequency === 'weekly') {
        let cursorDate = getNextWeeklyDate(effectiveStartDate, Number(rule.day_of_week));
        let safetyCounter = 0;
        while (cursorDate <= effectiveEndDate && safetyCounter < 400) {
            addPlannedImpact(impactByPeriod, getMonthKey(cursorDate), categoryType, rule.amount);
            cursorDate = addDays(cursorDate, 7);
            safetyCounter += 1;
        }
        return;
    }

    if (rule.frequency === 'monthly') {
        let cursorDate = getNextMonthlyDate(effectiveStartDate, Number(rule.day_of_month));
        let safetyCounter = 0;
        while (cursorDate <= effectiveEndDate && safetyCounter < 100) {
            addPlannedImpact(impactByPeriod, getMonthKey(cursorDate), categoryType, rule.amount);
            cursorDate = addMonths(cursorDate, 1, Number(rule.day_of_month));
            safetyCounter += 1;
        }
    }
};

const appendRecurringOccurrences = (rule, horizonStartDate, horizonEndDate, impactByPeriod) => {
    if (!rule.is_active) {
        return;
    }

    const categoryType = rule.category_type === 'income' ? 'income' : 'expense';
    let dueDate = getNextDueDate(rule);

    while (dueDate < horizonStartDate) {
        dueDate = rule.interval_type === 'weekly'
            ? addDays(dueDate, 7)
            : addMonths(dueDate, 1, rule.day_of_month || dueDate.getDate());
    }

    let safetyCounter = 0;
    while (dueDate <= horizonEndDate && safetyCounter < 120) {
        addPlannedImpact(impactByPeriod, getMonthKey(dueDate), categoryType, rule.amount);
        dueDate = rule.interval_type === 'weekly'
            ? addDays(dueDate, 7)
            : addMonths(dueDate, 1, rule.day_of_month || dueDate.getDate());
        safetyCounter += 1;
    }
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

const getPlannedTransactions = async (req, res) => {
    const scenarioFilter = req.query.scenario && String(req.query.scenario).trim()
        ? String(req.query.scenario).trim()
        : null;
    const fromDate = toDateOnlyString(req.query.from);
    const toDate = toDateOnlyString(req.query.to);
    const activeOnly = req.query.activeOnly === 'true';

    try {
        await ensurePlannedTransactionsTable();

        const whereConditions = [];
        const queryValues = [];

        if (scenarioFilter) {
            whereConditions.push('pt.scenario = ?');
            queryValues.push(scenarioFilter);
        }

        if (activeOnly) {
            whereConditions.push('pt.is_active = TRUE');
        }

        if (fromDate) {
            whereConditions.push('((pt.frequency = \'one_time\' AND pt.planned_date >= ?) OR (pt.frequency != \'one_time\' AND (pt.end_date IS NULL OR pt.end_date >= ?)))');
            queryValues.push(fromDate, fromDate);
        }

        if (toDate) {
            whereConditions.push('((pt.frequency = \'one_time\' AND pt.planned_date <= ?) OR (pt.frequency != \'one_time\' AND pt.start_date <= ?))');
            queryValues.push(toDate, toDate);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const [rows] = await dbPool.query(
            `
            SELECT
                pt.*,
                c.name AS category_name,
                c.type AS category_type
            FROM planned_transactions pt
            LEFT JOIN categories c ON c.id = pt.category_id
            ${whereClause}
            ORDER BY pt.created_at DESC;
            `,
            queryValues
        );

        res.status(200).json(rows.map(normalisePlannedTransaction));
    } catch (error) {
        console.error('Error fetching planned transactions:', error);
        res.status(500).json({ message: 'Failed to fetch planned transactions.' });
    }
};

const createPlannedTransaction = async (req, res) => {
    const validationResult = validatePlannedTransactionPayload(req.body);
    if (!validationResult.isValid) {
        return res.status(400).json({ message: validationResult.message });
    }

    try {
        await ensurePlannedTransactionsTable();

        const values = validationResult.values;
        const [result] = await dbPool.query(
            `
            INSERT INTO planned_transactions
            (description, amount, category_id, frequency, planned_date, start_date, end_date, day_of_week, day_of_month, scenario, is_active, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                values.description,
                values.amount,
                values.category_id,
                values.frequency,
                values.planned_date,
                values.start_date,
                values.end_date,
                values.day_of_week,
                values.day_of_month,
                values.scenario,
                values.is_active,
                values.notes,
            ]
        );

        res.status(201).json({ message: 'Planned transaction created.', id: result.insertId });
    } catch (error) {
        console.error('Error creating planned transaction:', error);
        res.status(500).json({ message: 'Failed to create planned transaction.' });
    }
};

const updatePlannedTransaction = async (req, res) => {
    const plannedTransactionId = Number(req.params.id);
    if (!Number.isInteger(plannedTransactionId)) {
        return res.status(400).json({ message: 'Invalid planned transaction ID.' });
    }

    try {
        await ensurePlannedTransactionsTable();

        const [existingRows] = await dbPool.query('SELECT * FROM planned_transactions WHERE id = ?', [plannedTransactionId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Planned transaction not found.' });
        }

        const existing = normalisePlannedTransaction(existingRows[0]);
        const mergedPayload = {
            ...existing,
            ...req.body,
            amount: req.body.amount === undefined ? existing.amount : req.body.amount,
            category_id: req.body.category_id === undefined ? existing.category_id : req.body.category_id,
            is_active: req.body.is_active === undefined ? existing.is_active : req.body.is_active,
        };

        const validationResult = validatePlannedTransactionPayload(mergedPayload);
        if (!validationResult.isValid) {
            return res.status(400).json({ message: validationResult.message });
        }

        const values = validationResult.values;
        await dbPool.query(
            `
            UPDATE planned_transactions
            SET description = ?, amount = ?, category_id = ?, frequency = ?, planned_date = ?, start_date = ?, end_date = ?, day_of_week = ?, day_of_month = ?, scenario = ?, is_active = ?, notes = ?
            WHERE id = ?
            `,
            [
                values.description,
                values.amount,
                values.category_id,
                values.frequency,
                values.planned_date,
                values.start_date,
                values.end_date,
                values.day_of_week,
                values.day_of_month,
                values.scenario,
                values.is_active,
                values.notes,
                plannedTransactionId,
            ]
        );

        res.status(200).json({ message: 'Planned transaction updated.' });
    } catch (error) {
        console.error('Error updating planned transaction:', error);
        res.status(500).json({ message: 'Failed to update planned transaction.' });
    }
};

const deletePlannedTransaction = async (req, res) => {
    const plannedTransactionId = Number(req.params.id);
    if (!Number.isInteger(plannedTransactionId)) {
        return res.status(400).json({ message: 'Invalid planned transaction ID.' });
    }

    try {
        await ensurePlannedTransactionsTable();
        const [result] = await dbPool.query('DELETE FROM planned_transactions WHERE id = ?', [plannedTransactionId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Planned transaction not found.' });
        }

        res.status(200).json({ message: 'Planned transaction deleted.' });
    } catch (error) {
        console.error('Error deleting planned transaction:', error);
        res.status(500).json({ message: 'Failed to delete planned transaction.' });
    }
};

const getForecast = async (req, res) => {
    const monthsAhead = Math.min(Math.max(Number(req.query.monthsAhead) || 6, 1), 24);
    const historyMonths = Math.min(Math.max(Number(req.query.historyMonths) || 12, 3), 36);
    const includePlanned = req.query.includePlanned !== 'false';
    const scenario = req.query.scenario && String(req.query.scenario).trim() ? String(req.query.scenario).trim() : 'base';

    const startMonth = req.query.startMonth && /^\d{4}-\d{2}$/.test(req.query.startMonth)
        ? req.query.startMonth
        : getMonthKey(new Date());

    const { periods, startDate, endDate } = getMonthRange(startMonth, monthsAhead);

    try {
        await ensurePlannedTransactionsTable();
        await ensureRecurringTable();

        const [historicalRows] = await dbPool.query(
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
            [historyMonths]
        );

        const historicalMap = new Map(
            historicalRows.map((row) => ([
                row.period,
                {
                    income: Number(row.income_total || 0),
                    expense: Number(row.expense_total || 0),
                }
            ]))
        );

        let historicalIncomeTotal = 0;
        let historicalExpenseTotal = 0;
        for (let index = 0; index < historyMonths; index += 1) {
            const periodDate = new Date();
            periodDate.setDate(1);
            periodDate.setMonth(periodDate.getMonth() - (historyMonths - 1 - index));
            const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;
            const row = historicalMap.get(period) || { income: 0, expense: 0 };
            historicalIncomeTotal += row.income;
            historicalExpenseTotal += row.expense;
        }

        const averageIncome = historicalIncomeTotal / historyMonths;
        const averageExpense = historicalExpenseTotal / historyMonths;

        const impactByPeriod = new Map();

        if (includePlanned) {
            const [plannedRows] = await dbPool.query(
                `
                SELECT pt.*, c.type AS category_type
                FROM planned_transactions pt
                LEFT JOIN categories c ON c.id = pt.category_id
                WHERE pt.is_active = TRUE
                    AND pt.scenario = ?;
                `,
                [scenario]
            );

            for (const row of plannedRows) {
                appendPlannedOccurrences(normalisePlannedTransaction(row), startDate, endDate, impactByPeriod);
            }
        }

        const [recurringRows] = await dbPool.query(
            `
            SELECT rt.*, c.type AS category_type
            FROM recurring_transactions rt
            LEFT JOIN categories c ON c.id = rt.category_id
            WHERE rt.is_active = TRUE;
            `
        );

        for (const row of recurringRows) {
            appendRecurringOccurrences(row, startDate, endDate, impactByPeriod);
        }

        const months = periods.map((period) => {
            const impact = impactByPeriod.get(period) || { income: 0, expense: 0 };
            const projectedIncome = Number((averageIncome + impact.income).toFixed(2));
            const projectedExpense = Number((averageExpense + impact.expense).toFixed(2));

            return {
                period,
                baseline_income: Number(averageIncome.toFixed(2)),
                baseline_expense: Number(averageExpense.toFixed(2)),
                planned_income_impact: Number(impact.income.toFixed(2)),
                planned_expense_impact: Number(impact.expense.toFixed(2)),
                projected_income: projectedIncome,
                projected_expense: projectedExpense,
                projected_net: Number((projectedIncome - projectedExpense).toFixed(2)),
            };
        });

        const projectedIncomeTotal = months.reduce((sum, month) => sum + month.projected_income, 0);
        const projectedExpenseTotal = months.reduce((sum, month) => sum + month.projected_expense, 0);

        res.status(200).json({
            inputs: {
                monthsAhead,
                historyMonths,
                scenario,
                includePlanned,
                startMonth,
            },
            assumptions: {
                method: 'trailing-average-plus-rules',
            },
            summary: {
                projected_income_total: Number(projectedIncomeTotal.toFixed(2)),
                projected_expense_total: Number(projectedExpenseTotal.toFixed(2)),
                projected_net_total: Number((projectedIncomeTotal - projectedExpenseTotal).toFixed(2)),
            },
            months,
        });
    } catch (error) {
        console.error('Error generating forecast:', error);
        res.status(500).json({ message: 'Failed to generate forecast.' });
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
    getPlannedTransactions,
    createPlannedTransaction,
    updatePlannedTransaction,
    deletePlannedTransaction,
    getForecast,
};