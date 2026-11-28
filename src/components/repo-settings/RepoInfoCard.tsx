import { Button, Select, Space, Spin, Typography } from 'antd'
import { Panel } from '../Widgets'
import { t } from '../../theme/tokens'

interface Props {
  repoInfo: { default_branch?: string; branches: string[] } | null | undefined
  loading: boolean
  errorText: string
  branchPicked: string
  onBranchPicked: (v: string) => void
  onRefresh: () => void
}

/** 仓库信息卡：默认分支 + 分支速查（平台 SDK BranchManager；best-effort）。 */
export default function RepoInfoCard({
  repoInfo,
  loading,
  errorText,
  branchPicked,
  onBranchPicked,
  onRefresh,
}: Props) {
  return (
    <Panel
      bodyStyle={{ padding: t.space.md }}
      style={{ marginBottom: t.space.lg }}
      title="仓库信息"
      extra={
        <Button size="small" onClick={onRefresh}>
          刷新分支
        </Button>
      }
    >
      <Spin spinning={loading}>
        {errorText ? (
          <Typography.Text type="secondary" className="meta-sm">
            分支面不可用：{errorText}（不影响下方设置编辑）
          </Typography.Text>
        ) : (
          <Space wrap size={t.space.lg} align="center">
            <span>
              <Typography.Text type="secondary" className="meta-sm">
                默认分支（.reviewagents.yaml 配置来源）
              </Typography.Text>
              <div>
                <Typography.Text className="mono" copyable={!!repoInfo?.default_branch}>
                  {repoInfo?.default_branch || '—'}
                </Typography.Text>
              </div>
            </span>
            <span style={{ minWidth: 260 }}>
              <Typography.Text type="secondary" className="meta-sm">
                分支速查（共 {repoInfo?.branches.length ?? 0} 个）
              </Typography.Text>
              <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center' }}>
                <Select
                  showSearch
                  allowClear
                  placeholder="选择分支名"
                  style={{ width: 220 }}
                  value={branchPicked || undefined}
                  onChange={(v) => onBranchPicked(v || '')}
                  options={(repoInfo?.branches ?? []).map((b) => ({ value: b, label: b }))}
                />
                {branchPicked && (
                  <Typography.Text className="mono t-xs" copyable={{ text: branchPicked }}>
                    {branchPicked}
                  </Typography.Text>
                )}
              </div>
            </span>
          </Space>
        )}
      </Spin>
    </Panel>
  )
}
