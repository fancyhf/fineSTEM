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
    if (tasks.length > 0) {
      localStorage.setItem('smart-todo-tasks', JSON.stringify(tasks))
    }
  }, [tasks])

  // Calculate priority score (higher = more important)
  const getPriorityScore = (task: Task): number => {
    const importanceScore = { high: 3, medium: 2, low: 1 }
    const urgencyScore = { high: 3, medium: 2, low: 1 }
    
    let score = importanceScore[task.importance] + urgencyScore[task.urgency]
    
    // Add deadline bonus (closer deadline = higher priority)
    if (task.deadline) {
      const daysUntil = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 1) score += 5
      else if (daysUntil <= 3) score += 3
      else if (daysUntil <= 7) score += 1
    }
    
    return score
  }

  // Check if task is due today
  const isDueToday = (task: Task): boolean => {
    if (!task.deadline) return false
    const today = new Date().toISOString().split('T')[0]
    return task.deadline === today
  }

  // Check if task is due today
  const isDueToday = (task: Task): boolean => {
    if (!task.deadline) return false
    const today = new Date().toISOString().split('T')[0]
    return task.deadline === today
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
    if (score >= 6) return styles.priorityHigh
    if (score >= 4) return styles.priorityMedium
    return styles.priorityLow
  }

  const getPriorityLabel = (task: Task): string => {
    const score = getPriorityScore(task)
    if (score >= 6) return '高'
    if (score >= 4) return '中'
    return '低'
  }

  const completedCount = tasks.filter(t => t.completed).length

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>智能待办清单</h1>
          <p>AI智能优先级排序</p>
          <div className={styles.stats}>
            <span>{tasks.length - completedCount} 待处理</span>
            <span>{completedCount} 已完成</span>
          </div>
        </header>

        <button 
          className={styles.addButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '取消' : '+ 添加新任务'}
        </button>

        {showForm && (
          <div className={styles.form}>
            <input
              type="text"
              placeholder="任务标题..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className={styles.input}
            />
            <textarea
              placeholder="任务描述（可选）..."
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
                <option value="low">低重要性</option>
                <option value="medium">中重要性</option>
                <option value="high">高重要性</option>
              </select>
              <select
                value={newTask.urgency}
                onChange={(e) => setNewTask({ ...newTask, urgency: e.target.value as any })}
                className={styles.select}
              >
                <option value="low">低紧急度</option>
                <option value="medium">中紧急度</option>
                <option value="high">高紧急度</option>
              </select>
            </div>
            <button onClick={addTask} className={styles.submitButton}>
              添加任务
            </button>
          </div>
        )}

        <div className={styles.taskList}>
          {sortedTasks.length === 0 ? (
            <p className={styles.empty}>暂无任务。添加你的第一个任务吧！</p>
          ) : (
            sortedTasks.map(task => (
              <div 
                key={task.id} 
                className={`${styles.task} ${task.completed ? styles.completed : ''} ${getPriorityColor(task)} ${isDueToday(task) ? styles.dueToday : ''}`}
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
                    <span>截止日期：{new Date(task.deadline).toLocaleDateString()}</span>
                  )}
                  <span>重要性：{task.importance}</span>
                  <span>紧急度：{task.urgency}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
