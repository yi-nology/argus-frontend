import { Card, Col, Row, Tag, Typography, Button, Space } from 'antd'
import { CheckCircleFilled, MinusCircleFilled, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import type { PermissionBits } from '../api/client'

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
        我的权限 <span className="grad-text">/ my_permissions</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        服务端投影 · 前端置灰仅提示，服务端仍 fail-closed 二次判定
      </Typography.Paragraph>

      <Card
        className="glass"
        title={
          <Space>
            <UserOutlined style={{ color: '#22d3ee' }} />
            身份
            <Tag color="purple">{user?.role || user?.scope || '—'}</Tag>
          </Space>
        }
        extra={<Button onClick={() => void refresh()}>刷新</Button>}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Typography.Text type="secondary">username</Typography.Text>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{user?.username}</div>
          </Col>
          <Col span={8}>
            <Typography.Text type="secondary">scope</Typography.Text>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{user?.scope || '—'}</div>
          </Col>
          <Col span={8}>
            <Typography.Text type="secondary">user_id</Typography.Text>
            <div className="mono" style={{ fontSize: 14 }}>{user?.user_id || '—'}</div>
          </Col>
        </Row>
      </Card>

      <Card className="glass" title={<span><SafetyCertificateOutlined /> 权限矩阵</span>} style={{ marginTop: 16 }}>
        <Row gutter={[12, 12]}>
          {PERMS.map((it) => {
            const ok = !!p[it.key]
            return (
              <Col xs={12} md={8} lg={6} key={it.key}>
                <div
                  className="glass-hover"
                  style={{
                    borderRadius: 12,
                    padding: 14,
                    border: `1px solid ${ok ? 'rgba(52,211,153,0.35)' : 'rgba(88,148,255,0.12)'}`,
                    background: ok ? 'rgba(52,211,153,0.08)' : 'rgba(18,28,48,0.5)',
                  }}
                >
                  <Space>
                    {ok ? (
                      <CheckCircleFilled style={{ color: '#34d399' }} />
                    ) : (
                      <MinusCircleFilled style={{ color: '#5c6f92' }} />
                    )}
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {it.label}
                    </span>
                  </Space>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{it.desc}</div>
                </div>
              </Col>
            )
          })}
        </Row>
      </Card>
    </div>
  )
}
