import {
  Alert,
  Button,
  Col,
  InputNumber,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { CommentOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Panel } from '../Widgets'
import { SEVERITY_FLOOR_OPTIONS } from '../../constants/vocab'
import { t } from '../../theme/tokens'
import { PRESETS, previewText, type FormState } from './types'

interface Props {
  state: FormState
  patch: (p: Partial<FormState>) => void
  dirty: boolean
}

/** 回复控制核心卡片：频次 / 数量 / 级别 三旋钮 + 快捷预设 + 效果预览 + OCR 开关。 */
export default function ReplyControlCard({ state, patch, dirty }: Props) {
  const preview = previewText(state)
  return (
    <Panel
      title={
        <Space>
          <CommentOutlined />
          回复控制
        </Space>
      }
      style={{ marginBottom: t.space.lg }}
      extra={dirty && <Tag color="orange">有未保存修改</Tag>}
    >
      <Space wrap style={{ marginBottom: t.space.lg }}>
        <Typography.Text type="secondary" className="meta-sm">
          快捷预设：
        </Typography.Text>
        {PRESETS.map((p) => (
          <Tooltip key={p.label} title={p.desc}>
            <Button size="small" onClick={() => patch(p.values)}>
              {p.label}
            </Button>
          </Tooltip>
        ))}
        <Typography.Text type="secondary" className="meta-sm">
          预设只改回复三个旋钮，保存后对下一个审查任务生效
        </Typography.Text>
      </Space>
      <Row gutter={[t.space.xxl, t.space.lg]}>
        <Col xs={24} md={8}>
          <Typography.Text strong>回复频次</Typography.Text>
          <Tooltip title="同一 MR 在该时间窗内不重复回帖（审查与报告照常，仅不回帖）。0 = 不节流。">
            <InfoCircleOutlined style={{ marginLeft: t.space.sm, color: t.color.textSubtle }} />
          </Tooltip>
          <Slider
            min={0}
            max={1440}
            step={15}
            marks={{ 0: '不节流', 30: '30分', 60: '1时', 240: '4时', 1440: '24时' }}
            value={state.throttle}
            onChange={(v) => patch({ throttle: v as number })}
            tooltip={{ formatter: (v) => (v === 0 ? '不节流' : `${v} 分钟`) }}
          />
          <InputNumber
            min={0}
            max={1440}
            value={state.throttle}
            onChange={(v) => patch({ throttle: v ?? 0 })}
            suffix="分钟"
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text strong>回复数量</Typography.Text>
          <Tooltip title="单个报告最多回帖的意见条数，超出按严重度取 top N，其余以计数行略去。0 = 不封顶。">
            <InfoCircleOutlined style={{ marginLeft: t.space.sm, color: t.color.textSubtle }} />
          </Tooltip>
          <div style={{ marginTop: t.space.sm }}>
            <InputNumber
              min={0}
              max={50}
              value={state.cap}
              onChange={(v) => patch({ cap: v ?? 0 })}
              suffix="条 / 报告"
              style={{ width: '100%' }}
            />
          </div>
          <Typography.Text type="secondary" className="meta-sm">
            建议 5–15；0 为不封顶
          </Typography.Text>
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text strong>回复级别</Typography.Text>
          <Tooltip title="只回帖该级别及以上的意见；更低级别静默，报告中保留计数。">
            <InfoCircleOutlined style={{ marginLeft: t.space.sm, color: t.color.textSubtle }} />
          </Tooltip>
          <div style={{ marginTop: t.space.sm }}>
            <Select
              value={state.floor}
              onChange={(v) => patch({ floor: v })}
              options={SEVERITY_FLOOR_OPTIONS}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
      </Row>

      <Alert
        style={{ marginTop: t.space.lg }}
        type="info"
        showIcon
        icon={<EyeOutlined />}
        title="效果预览"
        description={preview}
      />

      <div style={{ marginTop: t.space.lg }}>
        <Space>
          <Switch
            checked={state.ocrEnabled}
            onChange={(v) => patch({ ocrEnabled: v })}
            checkedChildren="OCR 开"
            unCheckedChildren="OCR 关"
          />
          <Typography.Text type="secondary">
            OCR 预检（文件分诊 + 规则注入）
            <Tooltip title="OCR 服务端点由部署环境变量控制（安全红线，不可在此配置）；此处仅控制本仓库是否使用。">
              <InfoCircleOutlined style={{ marginLeft: t.space.sm }} />
            </Tooltip>
          </Typography.Text>
        </Space>
      </div>
    </Panel>
  )
}
