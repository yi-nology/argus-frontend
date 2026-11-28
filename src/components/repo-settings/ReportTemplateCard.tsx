import { Select, Typography } from 'antd'
import { Panel } from '../Widgets'
import { t } from '../../theme/tokens'
import { REPORT_TEMPLATES, type FormState } from './types'

interface Props {
  state: FormState
  patch: (p: Partial<FormState>) => void
}

/** 报告模板选择卡（v8.8.0）：覆盖部署默认的报告结构。 */
export default function ReportTemplateCard({ state, patch }: Props) {
  return (
    <Panel title="报告模板" style={{ marginBottom: t.space.lg }}>
      <Select
        value={state.reportTemplate}
        onChange={(v) => patch({ reportTemplate: v })}
        options={REPORT_TEMPLATES}
        style={{ width: 320 }}
      />
      <Typography.Text type="secondary" style={{ marginLeft: t.space.md }}>
        裁决链：任务级 &gt; 本设置 &gt; 仓库 yaml &gt; 部署默认
      </Typography.Text>
    </Panel>
  )
}
