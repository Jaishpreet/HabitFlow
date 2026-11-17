import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../../config';

const Goals = () => {
    const [habits, setHabits] = useState([]);
    const [history, setHistory] = useState([]);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [selectedHabit, setSelectedHabit] = useState('');
    const [goalType, setGoalType] = useState('consistency'); // 'consistency' or 'flexible'
    const [targetAmount, setTargetAmount] = useState(7);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const habitsRes = await axios.get(`${API_URL}/habits`);
            setHabits(habitsRes.data);
            
            const historyRes = await axios.get(`${API_URL}/habits/history/all`);
            setHistory(historyRes.data);

            const stored = localStorage.getItem('habitGoalsV2'); // V2 to start fresh
            if (stored) {
                setGoals(JSON.parse(stored));
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const saveGoals = (updatedGoals) => {
        localStorage.setItem('habitGoalsV2', JSON.stringify(updatedGoals));
        setGoals(updatedGoals);
    };

    const addGoal = () => {
        if (!selectedHabit || targetAmount < 1) {
            toast.error('Please select a habit and set a valid target');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            toast.error('End date must be after start date');
            return;
        }

        const newGoalObj = {
            id: Date.now().toString(),
            habitId: selectedHabit,
            habitName: habits.find(h => h._id === selectedHabit)?.name || 'Unknown',
            type: goalType,
            target: parseInt(targetAmount),
            startDate: startDate,
            endDate: endDate,
            createdAt: new Date().toISOString()
        };

        const updated = [newGoalObj, ...goals];
        saveGoals(updated);
        
        // Reset Form
        setSelectedHabit('');
        setTargetAmount(7);
        toast.success('Challenge created! 🎯');
    };

    const deleteGoal = (goalId) => {
        if (!window.confirm('Delete this challenge?')) return;
        const updated = goals.filter(g => g.id !== goalId);
        saveGoals(updated);
        toast.success('Challenge deleted');
    };

    // Core Logic: Calculate Progress based on Date Range and Type
    const calculateProgress = (goal) => {
        // 1. Filter history for this specific habit and within the date range
        const relevantDays = history.filter(day => 
            day.date >= goal.startDate && 
            day.date <= goal.endDate && 
            day.habitIds.includes(goal.habitId)
        );

        const completedCount = relevantDays.length;
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Determine Status
        let status = 'active';
        let progressPercent = 0;
        let displayString = '';

        if (goal.type === 'flexible') {
            // Flexible Target Logic
            progressPercent = Math.min(Math.round((completedCount / goal.target) * 100), 100);
            displayString = `${completedCount} / ${goal.target} times`;
            
            if (completedCount >= goal.target) {
                status = 'completed';
            } else if (todayStr > goal.endDate) {
                status = 'failed';
            }
        } else {
            // Consistency (Streak) Logic
            // We need to find the max consecutive days within the range
            let currentStreak = 0;
            let maxStreak = 0;
            
            // Create a set of completed dates for O(1) lookup
            const completedDates = new Set(relevantDays.map(d => d.date));
            
            // Loop through the date range day by day
            let loopDate = new Date(goal.startDate);
            const endLoopDate = new Date(goal.endDate);
            
            while (loopDate <= endLoopDate) {
                const dateStr = loopDate.toISOString().split('T')[0];
                if (completedDates.has(dateStr)) {
                    currentStreak++;
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                } else {
                    currentStreak = 0;
                }
                loopDate.setDate(loopDate.getDate() + 1);
            }

            progressPercent = Math.min(Math.round((maxStreak / goal.target) * 100), 100);
            displayString = `Best: ${maxStreak} / ${goal.target} days in a row`;

            if (maxStreak >= goal.target) {
                status = 'completed';
            } else if (todayStr > goal.endDate) {
                status = 'failed';
            }
        }

        return { progressPercent, displayString, status, completedCount };
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading goals...</div></div>;
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">🎯 Challenges & Goals</h1>

            {/* Creation Form */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">Create a New Challenge</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">Select Habit</label>
                        <select
                            value={selectedHabit}
                            onChange={(e) => setSelectedHabit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Choose a habit...</option>
                            {habits.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">Challenge Type</label>
                        <select
                            value={goalType}
                            onChange={(e) => setGoalType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="consistency">Consistency Challenge (Streak)</option>
                            <option value="flexible">Flexible Target (Total Times)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">
                            Target {goalType === 'consistency' ? 'Days in a row' : 'Total Times'}
                        </label>
                        <input
                            type="number"
                            value={targetAmount}
                            onChange={(e) => setTargetAmount(e.target.value)}
                            min={1}
                            max={365}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <button
                    onClick={addGoal}
                    className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                    Start Challenge
                </button>
            </div>

            {/* Goals List */}
            <h3 className="font-semibold text-gray-900 mb-4">Your Active & Past Challenges</h3>
            {goals.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <span className="text-5xl block mb-3">🏆</span>
                    <p className="text-gray-500 font-medium">No challenges created yet</p>
                    <p className="text-gray-400 text-sm">Set a goal above to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {goals.map(goal => {
                        const { progressPercent, displayString, status, completedCount } = calculateProgress(goal);
                        
                        // Style based on status
                        let badgeColor = 'bg-blue-100 text-blue-700';
                        let badgeText = 'Active';
                        let borderColor = 'border-gray-100';
                        let barColor = 'bg-indigo-500';

                        if (status === 'completed') {
                            badgeColor = 'bg-green-100 text-green-700';
                            badgeText = '🏆 Completed';
                            borderColor = 'border-green-200';
                            barColor = 'bg-green-500';
                        } else if (status === 'failed') {
                            badgeColor = 'bg-red-100 text-red-700';
                            badgeText = '❌ Failed';
                            borderColor = 'border-red-200';
                            barColor = 'bg-red-400';
                        }

                        return (
                            <div key={goal.id} className={`bg-white rounded-xl p-5 shadow-sm border ${borderColor} relative overflow-hidden`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-lg font-bold text-gray-900">{goal.habitName}</h4>
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                                                {badgeText}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {goal.type === 'consistency' ? 'Consistency Challenge' : 'Flexible Target'} • 
                                            {goal.startDate} to {goal.endDate}
                                        </p>
                                    </div>
                                    <button onClick={() => deleteGoal(goal.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                                        🗑️
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="font-medium text-gray-700">{displayString}</span>
                                        <span className="font-bold text-gray-900">{progressPercent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div 
                                            className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                                            style={{ width: `${progressPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Goals;