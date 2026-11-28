import { Col, InputNumber, Row, Select, Space, Typography } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { Panel } from '../Widgets'
import { t } from '../../theme/tokens'
import { DIFF_CAP_PRESETS, TOKEN_BUDGET_PRESETS, type FormState } from './types'

interface Props {
  state: FormState
  patch: (p: Partial<FormState>) => void
}

/** 预算与上限卡片：月度 / 单任务 token 预算 + diff 字符上限，常用值下拉一键填。 */
export default function BudgetCard({ state, patch }: Props) {
  return (
    <Panel
      title={
        <Space>
          <ThunderboltOutlined />
          预算与上限
        </Space>
      }
      style={{ marginBottom: t.space.lg }}
    >
      <Row gutter={[t.space.xxl, t.space.lg]}>
        <Col xs={24} md={8}>
          <Typography.Text strong>月度 token 预算</Typography.Text>
          <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
            <InputNumber
              min={1}
              max={1_000_000_000}
              value={state.monthlyBudget}
              onChange={(v) => patch({ monthlyBudget: v ?? undefined })}
              placeholder="继承全局"
              style={{ flex: 1 }}
            />
            <Select
              style={{ width: 118 }}
              placeholder="常用值"
              options={TOKEN_BUDGET_PRESETS}
              value={undefined}
              onChange={(v: number) => patch({ monthlyBudget: v > 0 ? v : undefined })}
            />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text strong>单任务 token 预算</Typography.Text>
          <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
            <InputNumber
              min={1}
              max={1_000_000_000}
              value={state.taskBudget}
              onChange={(v) => patch({ taskBudget: v ?? undefined })}
              placeholder="继承全局"
              style={{ flex: 1 }}
            />
            <Select
              style={{ width: 118 }}
              placeholder="常用值"
              options={TOKEN_BUDGET_PRESETS}
              value={undefined}
              onChange={(v: number) => patch({ taskBudget: v > 0 ? v : undefined })}
            />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text strong>diff 字符上限</Typography.Text>
          <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
            <InputNumber
              min={1}
              max={1_000_000_000}
              value={state.maxDiffChars}
              onChange={(v) => patch({ maxDiffChars: v ?? undefined })}
              placeholder="继承全局"
              style={{ flex: 1 }}
            />
            <Select
              style={{ width: 118 }}
              placeholder="常用值"
              options={DIFF_CAP_PRESETS}
              value={undefined}
              onChange={(v: number) => patch({ maxDiffChars: v > 0 ? v : undefined })}
            />
          </div>
        </Col>
      </Row>
    </Panel>
  )
}
