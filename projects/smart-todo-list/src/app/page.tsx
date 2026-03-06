'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.css'

interface Task {
  id: string
  title: string
  description: string
  deadline: string
  importance: 'high' | 'medium' | 'low'
  urgency: 'high' | 'medium' | 'low'
  completed: boolean
  createdAt: number
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    importance: 'medium' as const,
    urgency: 'medium' as const
  })

  // Load tasks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('smart-todo-tasks')
    if (saved) {
      try {
        setTasks(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load tasks:', e)
      }
    }
  }, [])

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('smart-todo-tasks', JSON.stringify(tasks))
  }, [tasks])

  // Calculate priority score (higher = more important)
  const getPriorityScore = (task: Task): number => {
    const importanceScore = { high: 3, medium: 2, low: 1 }
    const urgencyScore = { high: 3, medium: 2, low: 1 }
    
    let score = importanceScore[task.importance] * 10 + urgencyScore[task.urgency] * 10
    
    // Add deadline bonus (closer deadline = higher priority)
    if (task.deadline) {
      const daysUntil = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 1) score += 50
      else if (daysUntil <= 3) score += 30
      else if (daysUntil <= 7) score += 10
    }
    
    return score
  }

  // Sort tasks by priority
  const sortedTasks = [...tasks].sort((a, b) => {
    // Completed tasks go to bottom
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    // Sort by priority score (descending)
    return getPriorityScore(b) - getPriorityScore(a)
  })

  const addTask = () => {
    if (!newTask.title.trim()) return
    
    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      deadline: newTask.deadline,
      importance: newTask.importance,
      urgency: newTask.urgency,
      completed: false,
      createdAt: Date.now()
    }
    
    setTasks([...tasks, task])
    setNewTask({ title: '', description: '', deadline: '', importance: 'medium', urgency: 'medium' })
    setShowForm(false)
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const getPriorityColor = (task: Task): string => {
    const score = getPriorityScore(task)
    if (score >= 70) return styles.priorityHigh
    if (score >= 40) return styles.priorityMedium
    return styles.priorityLow
  }

  const getPriorityLabel = (task: Task): string => {
    const score = getPriorityScore(task)
    if (score >= 70) return 'High'
    if (score >= 40) return 'Medium'
    return 'Low'
  }

  const completedCount = tasks.filter(t => t.completed).length

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Smart Todo List</h1>
          <p>AI-powered priority sorting</p>
          <div className={styles.stats}>
            <span>{tasks.length - completedCount} pending</span>
            <span>{completedCount} completed</span>
          </div>
        </header>

        <button 
          className={styles.addButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add New Task'}
        </button>

        {showForm && (
          <div className={styles.form}>
            <input
              type="text"
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className={styles.input}
            />
            <textarea
              placeholder="Description (optional)..."
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className={styles.textarea}
            />
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              className={styles.input}
            />
            <div className={styles.selects}>
              <select
                value={newTask.importance}
                onChange={(e) => setNewTask({ ...newTask, importance: e.target.value as any })}
                className={styles.select}
              >
                <option value="low">Low Importance</option>
                <option value="medium">Medium Importance</option>
                <option value="high">High Importance</option>
              </select>
              <select
                value={newTask.urgency}
                onChange={(e) => setNewTask({ ...newTask, urgency: e.target.value as any })}
                className={styles.select}
              >
                <option value="low">Low Urgency</option>
                <option value="medium">Medium Urgency</option>
                <option value="high">High Urgency</option>
              </select>
            </div>
            <button onClick={addTask} className={styles.submitButton}>
              Add Task
            </button>
          </div>
        )}

        <div className={styles.taskList}>
          {sortedTasks.length === 0 ? (
            <p className={styles.empty}>No tasks yet. Add your first task!</p>
          ) : (
            sortedTasks.map(task => (
              <div 
                key={task.id} 
                className={`${styles.task} ${task.completed ? styles.completed : ''} ${getPriorityColor(task)}`}
              >
                <div className={styles.taskHeader}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.priorityBadge}>
                    {getPriorityLabel(task)}
                  </span>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
                <h3 className={styles.taskTitle}>{task.title}</h3>
                {task.description && (
                  <p className={styles.taskDesc}>{task.description}</p>
                )}
                <div className={styles.taskMeta}>
                  {task.deadline && (
                    <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                  )}
                  <span>Importance: {task.importance}</span>
                  <span>Urgency: {task.urgency}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
