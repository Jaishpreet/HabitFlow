import express from 'express';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// ============================================================
// GET ALL HABITS
// ============================================================
router.get('/', auth, async (req, res) => {
    try {
        const habits = await Habit.find({ userId: req.userId }).sort({ createdAt: -1 });
        
        // Force local time to match the frontend
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const habitsWithStatus = await Promise.all(habits.map(async (habit) => {
            const log = await HabitLog.findOne({
                habitId: habit._id,
                userId: req.userId,
                date: today
            });
            return {
                ...habit.toObject(),
                todayCompleted: log ? log.completed : false
            };
        }));
        
        res.json(habitsWithStatus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// CREATE A HABIT
// ============================================================
router.post('/', auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Habit name is required' });
        }
        const habit = new Habit({
            userId: req.userId,
            name: name.trim(),
            description: description?.trim() || ''
        });
        await habit.save();
        res.status(201).json({ ...habit.toObject(), todayCompleted: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// DELETE A HABIT
// ============================================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });
        await HabitLog.deleteMany({ habitId: req.params.id });
        res.json({ message: 'Habit deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// TOGGLE COMPLETION
// ============================================================
router.post('/:id/log', auth, async (req, res) => {
    try {
        const { completed, date } = req.body;
        const habit = await Habit.findOne({ _id: req.params.id, userId: req.userId });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });

        // Fix timezone issue by forcing local time
        let logDate;
        if (date) {
            const [y, m, d] = date.split('-');
            logDate = new Date(y, m - 1, d);
        } else {
            const now = new Date();
            logDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }

        let log = await HabitLog.findOne({ habitId: req.params.id, userId: req.userId, date: logDate });

        if (log) {
            log.completed = completed !== undefined ? completed : !log.completed;
            await log.save();
        } else {
            log = new HabitLog({
                habitId: req.params.id,
                userId: req.userId,
                date: logDate,
                completed: completed !== undefined ? completed : true
            });
            await log.save();
        }
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// GET ALL HISTORY AT ONCE (SUPER FAST)
// ============================================================
router.get('/history/all', auth, async (req, res) => {
    try {
        const logs = await HabitLog.find({ userId: req.userId }).sort({ date: 1 });
        
        const historyMap = {};
        logs.forEach(log => {
            const d = new Date(log.date);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            if (!historyMap[dateKey]) historyMap[dateKey] = [];
            if (log.completed) {
                historyMap[dateKey].push(log.habitId.toString());
            }
        });

        let startDate = new Date();
        if (logs.length > 0) {
            startDate = new Date(logs[0].date);
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const allDates = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            allDates.push({
                date: dateKey,
                habitIds: historyMap[dateKey] || [],
                day: currentDate.getDate(),
                month: currentDate.toLocaleString('default', { month: 'short' })
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json(allDates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// EXPORT ALL HABIT DATA (CSV)
// ============================================================
router.get('/export', auth, async (req, res) => {
    try {
        const habits = await Habit.find({ userId: req.userId });
        const logs = await HabitLog.find({ userId: req.userId }).sort({ date: 1 });

        const exportData = [];
        for (const log of logs) {
            const habit = habits.find(h => h._id.toString() === log.habitId.toString());
            if (habit) {
                exportData.push({
                    habitName: habit.name,
                    date: log.date.toISOString().split('T')[0],
                    completed: log.completed
                });
            }
        }
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;