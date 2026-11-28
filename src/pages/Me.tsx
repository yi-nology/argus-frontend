import { Col, Row, Tag, Typography, Button, Space } from 'antd'
import {
  CheckCircleFilled,
  MinusCircleFilled,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import type { PermissionBits } from '../api/client'
import { Panel } from '../components/Widgets'
import { t } from '../theme/tokens'

const PERMS: { key: keyof PermissionBits; label: string; desc: string }[] = [
  { key: 'read_repository', label: 'read_repository', desc: '读仓库 / 任务元数据' },
  { key: 'request_review', label: 'request_review', desc: '发起审查' },
  { key: 'decide_review', label: 'decide_review', desc: '审批票 / 裁定' },
  { key: 'apply_fix', label: 'apply_fix', desc: '受控推送确认' },
  { key: 'merge_pr', label: 'merge_pr', desc: '合并资格门 confirm' },
  { key: 'read_audit', label: 'read_audit', desc: '审计读取' },
  { key: 'manage_membership', label: 'manage_membership', desc: '邀请成员' },
  { key: 'manage_instance', label: 'manage_instance', desc: '实例 / 控制面' },
]

export default function Me() {
  const { user, refresh } = useAuth()
  const p = user?.permissions || {}

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        我的权限
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        以下权限由服务端根据角色投影生成；界面展示仅作参考，实际读写判定以服务端为准。
      </Typography.Paragraph>

      <Panel
        title={
          <Space>
            <UserOutlined style={{ color: t.color.accent }} />
            身份
            <Tag>{user?.role || user?.scope || '—'}</Tag>
          </Space>
        }
        extra={<Button onClick={() => void refresh()}>刷新</Button>}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">username</Typography.Text>
            <div className="t-lg t-semibold">{user?.username}</div>
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">scope</Typography.Text>
            <div className="mono t-lg t-semibold">{user?.scope || '—'}</div>
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">user_id</Typography.Text>
            <div className="mono t-md">{user?.user_id || '—'}</div>
          </Col>
        </Row>
      </Panel>

      <Panel
        className="section"
        title={
          <span>
            <SafetyCertificateOutlined /> 权限矩阵
          </span>
        }
      >
        <Row gutter={[12, 12]}>
          {PERMS.map((it) => {
            const ok = !!p[it.key]
            return (
              <Col xs={12} md={8} lg={6} key={it.key}>
                <div
                  className="panel panel-hover"
                  style={{
                    padding: t.space.lg,
                    borderColor: ok ? t.color.success : t.color.borderMuted,
                    background: ok ? t.color.successSubtle : t.color.surfaceSubtle,
                  }}
                >
                  <Space>
                    {ok ? (
                      <CheckCircleFilled style={{ color: t.color.success }} />
                    ) : (
                      <MinusCircleFilled style={{ color: t.color.textSubtle }} />
                    )}
                    <span className="mono t-xs t-semibold">{it.label}</span>
                  </Space>
                  <div className="meta-sm" style={{ marginTop: t.space.sm }}>
                    {it.desc}
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>
      </Panel>
    </div>
  )
}
