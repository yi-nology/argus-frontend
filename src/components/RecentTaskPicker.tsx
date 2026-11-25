/**
 * RecentTaskPicker —— 从最近任务一键载入仓库坐标（v8.7.0 控制台可用性迭代：
 * 把 FixPush 页验证过的模式推广到审批/合并/问答/意见页，免去手输四件套）。
 */
import { useEffect, useState } from 'react'
import { Select } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { api, type TaskRow } from '../api/client'
import { statusLabel } from '../constants/vocab'

export default function RecentTaskPicker({
  onPick,
  disabled,
  placeholder = '从最近任务载入（自动填充仓库坐标）',
  style,
}: {
  onPick: (t: TaskRow) => void
  disabled?: boolean
  placeholder?: string
  style?: React.CSSProperties
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [value, setValue] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    api
      .listTasks({ limit: 30 })
      .then((rows) => {
        if (!alive) return
        setTasks(
          rows.filter((t) => !!t.id && !!t.platform && !!t.owner && !!t.repo && !!t.number),
        )
      })
      .catch(() => {
        /* 清单失败不阻断手填坐标 */
      })
    return () => {
      alive = false
    }
  }, [])

  if (tasks.length === 0) return null

  return (
    <Select
      showSearch
      allowClear
      disabled={disabled}
      value={value}
      placeholder={
        <span>
          <HistoryOutlined style={{ marginRight: 6 }} />
          {placeholder}
        </span>
      }
      style={style ?? { width: '100%', maxWidth: 560 }}
      options={tasks.map((t) => ({
        value: (t.id || t.task_id)!,
        label: `${t.platform}/${t.owner}/${t.repo}#${t.number} · ${statusLabel(t.status)}`,
      }))}
      filterOption={(input, opt) =>
        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      onChange={(id) => {
        setValue(id || undefined)
        if (!id) return
        const t = tasks.find((x) => (x.id || x.task_id) === id)
        if (t) onPick(t)
      }}
    />
  )
}