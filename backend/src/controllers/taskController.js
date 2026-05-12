import { pool } from '../config/database.js';



export const listTasks = async (req, res) => {
    const { role, id: viewerId } = req.user;
    try {
        let rows;
        if (role === 'manager') {
            [rows] = await pool.query(
                `SELECT t.*,
                        u.username AS assigned_to_name,
                        b.username AS assigned_by_name
                 FROM manager_tasks t
                 JOIN users u ON u.id = t.assigned_to
                 JOIN users b ON b.id = t.assigned_by
                 WHERE t.assigned_to = ?
                 ORDER BY t.created_at DESC`,
                [viewerId]
            );
        } else {
            [rows] = await pool.query(
                `SELECT t.*,
                        u.username AS assigned_to_name,
                        b.username AS assigned_by_name
                 FROM manager_tasks t
                 JOIN users u ON u.id = t.assigned_to
                 JOIN users b ON b.id = t.assigned_by
                 ORDER BY t.created_at DESC`
            );
        }
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listTasks error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
};


export const createTask = async (req, res) => {
    const { title, description, assigned_to } = req.body;
    const assignedBy = req.user.id;

    if (!title?.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!assigned_to) {
        return res.status(400).json({ success: false, message: 'assigned_to is required' });
    }

    try {

        const [users] = await pool.query('SELECT id, role FROM users WHERE id = ?', [assigned_to]);
        if (!users[0]) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (users[0].role !== 'manager') {
            return res.status(400).json({ success: false, message: 'Tasks can only be assigned to users with the manager role' });
        }

        const [rows] = await pool.query(
            `INSERT INTO manager_tasks (title, description, assigned_to, assigned_by)
             VALUES (?, ?, ?, ?)
             RETURNING id, title, description, assigned_to, assigned_by, status, created_at`,
            [title.trim(), description?.trim() || null, assigned_to, assignedBy]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('createTask error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create task' });
    }
};


export const updateTaskStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { id: userId, role: userRole } = req.user;

    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `status must be one of: ${validStatuses.join(', ')}`,
        });
    }

    try {
        const [tasks] = await pool.query('SELECT * FROM manager_tasks WHERE id = ?', [id]);
        if (!tasks[0]) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        if (userRole === 'manager' && tasks[0].assigned_to !== userId) {
            return res.status(403).json({ success: false, message: 'You can only update your own tasks' });
        }

        await pool.query(
            'UPDATE manager_tasks SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );
        return res.json({ success: true, data: { id: Number(id), status } });
    } catch (err) {
        console.error('updateTaskStatus error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update task status' });
    }
};


export const getManagers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, email, full_name
             FROM users
             WHERE role = 'manager' AND deleted_at IS NULL
             ORDER BY username ASC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getManagers error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch managers' });
    }
};
