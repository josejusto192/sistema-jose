import React, { useState, useMemo, useEffect } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, format, addMonths, subMonths, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTheme } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { IconCheck, IconX, IconEdit, IconTrash, IconPlus, IconClock } from './Icons.jsx'

export const TASK_TYPES = {
  followup: { label: 'Follow-up',     emoji: '⏰', color: '#F59E0B', bg: '#FFFBEB', darkColor: '#FCD34D', darkBg: '#2D1A00', dot: '#F59E0B' },
  call:     { label: 'Call / Reunião', emoji: '📞', color: '#3B82F6', bg: '#EFF6FF', darkColor: '#60A5FA', darkBg: '#1E3A5F', dot: '#3B82F6' },
  proposta: { label: 'Proposta',       emoji: '📋', color: '#8B5CF6', bg: '#F5F3FF', darkColor: '#A78BFA', darkBg: '#1E1040', dot: '#8B5CF6' },
  tarefa:   { label: 'Tarefa',         emoji: '✅', color: '#10B981', bg: '#ECFDF5', darkColor: '#34D399', darkBg: '#052E16', dot: '#10B981' },
}

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/* ─── Task form modal ──────────────────────────────────────────────────────── */
function TaskModal({ task, empresas, userId, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    type: task?.type || 'followup',
    due_date: task?.due_date || format(new Date(), 'yyyy-MM-dd'),
    due_time: task?.due_time || '',
    empresa_id: task?.empresa_id || '',
    empresa_nome: task?.empresa_nome || '',
    notes: task?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleEmpresa(e) {
    const id = e.target.value
    const emp = empresas.find(x => x.id === id)
    setField('empresa_id', id)
    setField('empresa_nome', emp ? (emp.tipo === 'pessoa' ? [emp.nome, emp.sobrenome].filter(Boolean).join(' ') || emp.nome_fantasia || emp.razao_social : emp.nome_fantasia || emp.razao_social) : '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.due_date) return
    setSaving(true)
    await onSave({
      ...(task || {}),
      ...form,
      user_id: userId,
      empresa_id: form.empresa_id || null,
      empresa_nome: form.empresa_nome || null,
      due_time: form.due_time || null,
      notes: form.notes || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {task?.id ? 'Editar tarefa' : 'Nova tarefa'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
            <IconX size={18} color="var(--text3)" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Título */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Título *</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Ex: Ligar para confirmar proposta"
              required
              style={{ width: '100%', padding: '9px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Tipo */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Tipo</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(TASK_TYPES).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setField('type', key)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: '1px solid',
                    fontSize: 12, cursor: 'pointer', fontWeight: form.type === key ? 600 : 400,
                    background: form.type === key ? cfg.bg : 'transparent',
                    color: form.type === key ? cfg.color : 'var(--text3)',
                    borderColor: form.type === key ? cfg.color + '80' : 'var(--border)',
                  }}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data + Hora */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Data *</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setField('due_date', e.target.value)}
                required
                style={{ width: '100%', padding: '9px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Hora</label>
              <input
                type="time"
                value={form.due_time}
                onChange={e => setField('due_time', e.target.value)}
                style={{ width: '100%', padding: '9px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Lead vinculado */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Lead vinculado</label>
            <select
              value={form.empresa_id}
              onChange={handleEmpresa}
              style={{ width: '100%', padding: '9px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: form.empresa_id ? 'var(--text)' : 'var(--text3)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Nenhum lead</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.tipo === 'pessoa' ? [emp.nome, emp.sobrenome].filter(Boolean).join(' ') || emp.nome_fantasia || emp.razao_social : emp.nome_fantasia || emp.razao_social}
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              style={{ width: '100%', padding: '9px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#00CB53', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Task card ────────────────────────────────────────────────────────────── */
function TaskCard({ task, onToggle, onEdit, onDelete, onClickEmpresa }) {
  const theme = useTheme()
  const cfg = TASK_TYPES[task.type] || TASK_TYPES.tarefa
  const color = theme === 'dark' ? cfg.darkColor : cfg.color
  const bg = theme === 'dark' ? cfg.darkBg : cfg.bg

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', background: 'var(--bg2)',
      border: '1px solid var(--border)', borderRadius: 10,
      opacity: task.completed ? 0.55 : 1, transition: 'opacity 0.15s',
    }}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task)}
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
          border: `2px solid ${task.completed ? cfg.dot : 'var(--border)'}`,
          background: task.completed ? cfg.dot : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {task.completed && <IconCheck size={11} color="#fff" />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 10, background: bg, color, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {cfg.emoji} {cfg.label}
          </span>
          {task.due_time && (
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
              <IconClock size={11} color="var(--text3)" /> {task.due_time.slice(0, 5)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: task.completed ? 'line-through' : 'none', lineHeight: 1.3 }}>
          {task.title}
        </div>
        {task.empresa_nome && (
          <div
            onClick={onClickEmpresa && task.empresa_id ? e => { e.stopPropagation(); onClickEmpresa(task.empresa_id) } : undefined}
            style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, cursor: onClickEmpresa && task.empresa_id ? 'pointer' : 'default', textDecoration: onClickEmpresa && task.empresa_id ? 'underline' : 'none' }}
          >
            {task.empresa_nome}
          </div>
        )}
        {task.notes && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>{task.notes}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
          <IconEdit size={13} color="var(--text3)" />
        </button>
        <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
          <IconTrash size={13} color="var(--text3)" />
        </button>
      </div>
    </div>
  )
}

/* ─── Main Agenda component ────────────────────────────────────────────────── */
export default function Agenda({ tasks, empresas, userId, onSave, onDelete, onToggle, onOpenLead }) {
  const isMobile = useIsMobile()
  const theme = useTheme()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [modal, setModal] = useState(null) // null | { task? }

  // Calendar grid days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Tasks indexed by date string
  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      const key = t.due_date
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [tasks])

  const selectedKey = format(selectedDay, 'yyyy-MM-dd')
  const selectedTasks = (tasksByDate[selectedKey] || []).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return (a.due_time || '99:99').localeCompare(b.due_time || '99:99')
  })

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayCount = (tasksByDate[todayKey] || []).filter(t => !t.completed).length

  function openNew(day) {
    setModal({ task: { due_date: format(day, 'yyyy-MM-dd') } })
  }

  function handleClickEmpresa(empresaId) {
    if (!onOpenLead) return
    const lead = empresas.find(e => e.id === empresaId)
    if (lead) onOpenLead(lead)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '14px 16px 12px' : '20px 32px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)', margin: 0 }}>Agenda</h1>
          {todayCount > 0 && (
            <span style={{ fontSize: 12, background: '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
              {todayCount} hoje
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
            >
              Hoje
            </button>
            <button
              onClick={() => setModal({ task: null })}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#00CB53', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconPlus size={14} color="#fff" /> Nova tarefa
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>

        {/* Calendar */}
        <div style={{ flex: isMobile ? 'none' : '1 1 0', padding: isMobile ? '12px 12px 0' : '20px 0 20px 32px', minWidth: 0 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
          </div>

          {/* Week day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayTasks = tasksByDate[key] || []
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = isSameDay(day, selectedDay)
              const isTodayDay = isToday(day)
              const pendingCount = dayTasks.filter(t => !t.completed).length

              return (
                <div
                  key={key}
                  onClick={() => { setSelectedDay(day); if (!isSameMonth(day, currentMonth)) setCurrentMonth(day) }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    padding: '6px 4px 4px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: isSelected
                      ? '#00CB53'
                      : isTodayDay
                        ? (theme === 'dark' ? '#052E16' : '#ECFDF5')
                        : 'transparent',
                    border: isTodayDay && !isSelected ? '1px solid #00CB5360' : '1px solid transparent',
                    transition: 'background 0.1s',
                    opacity: isCurrentMonth ? 1 : 0.3,
                  }}
                  onMouseEnter={el => { if (!isSelected) el.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseLeave={el => {
                    el.currentTarget.style.background = isSelected
                      ? '#00CB53'
                      : isTodayDay
                        ? (theme === 'dark' ? '#052E16' : '#ECFDF5')
                        : 'transparent'
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: isTodayDay || isSelected ? 700 : 400,
                    color: isSelected ? '#fff' : isTodayDay ? '#00CB53' : 'var(--text)',
                    lineHeight: 1,
                  }}>
                    {format(day, 'd')}
                  </span>

                  {dayTasks.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {dayTasks.slice(0, 3).map((t, i) => {
                        const tc = TASK_TYPES[t.type] || TASK_TYPES.tarefa
                        return (
                          <div
                            key={i}
                            style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: isSelected ? 'rgba(255,255,255,0.7)' : tc.dot,
                              opacity: t.completed ? 0.4 : 1,
                            }}
                          />
                        )
                      })}
                      {dayTasks.length > 3 && (
                        <span style={{ fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text3)', lineHeight: 1 }}>
                          +{dayTasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        {!isMobile && <div style={{ width: 1, background: 'var(--border)', margin: '20px 0', flexShrink: 0 }} />}

        {/* Day panel */}
        <div style={{
          width: isMobile ? '100%' : 340, flexShrink: 0,
          padding: isMobile ? '16px 12px' : '20px 24px 20px 20px',
          display: 'flex', flexDirection: 'column', gap: 10,
          overflow: isMobile ? 'visible' : 'auto',
        }}>
          {/* Day header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
                {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </div>
              {isToday(selectedDay) && (
                <div style={{ fontSize: 11, color: '#00CB53', fontWeight: 600, marginTop: 1 }}>Hoje</div>
              )}
            </div>
            <button
              onClick={() => openNew(selectedDay)}
              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Adicionar tarefa neste dia"
            >
              <IconPlus size={14} color="var(--text2)" />
            </button>
          </div>

          {/* Task list for selected day */}
          {selectedTasks.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              border: '1px dashed var(--border)', borderRadius: 10,
              color: 'var(--text3)', fontSize: 12,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
              Nenhuma tarefa para este dia
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => openNew(selectedDay)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#00CB53', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Adicionar
                </button>
              </div>
            </div>
          ) : (
            selectedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={onToggle}
                onEdit={t => setModal({ task: t })}
                onDelete={onDelete}
                onClickEmpresa={onOpenLead ? handleClickEmpresa : undefined}
              />
            ))
          )}

          {/* Upcoming section */}
          {(() => {
            const upcoming = tasks
              .filter(t => {
                const d = parseISO(t.due_date)
                return !t.completed && !isSameDay(d, selectedDay) && d > selectedDay
              })
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .slice(0, 5)
            if (upcoming.length === 0) return null
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Próximas
                </div>
                {upcoming.map(task => {
                  const cfg = TASK_TYPES[task.type] || TASK_TYPES.tarefa
                  return (
                    <div
                      key={task.id}
                      onClick={() => { setSelectedDay(parseISO(task.due_date)); setCurrentMonth(parseISO(task.due_date)); setModal({ task }) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                        borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={el => el.currentTarget.style.background = 'var(--bg3)'}
                      onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                        {task.empresa_nome && <div style={{ fontSize: 10, color: 'var(--accent)' }}>{task.empresa_nome}</div>}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                        {format(parseISO(task.due_date), "d MMM", { locale: ptBR })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Modal */}
      {modal !== null && (
        <TaskModal
          task={modal.task}
          empresas={empresas}
          userId={userId}
          onSave={onSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
