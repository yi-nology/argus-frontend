import { Col, Row, Statistic, Typography } from 'antd'
import type { RepoStatsRow } from '../../api/client'
import { Panel } from '../Widgets'
import { t } from '../../theme/tokens'

/**
 * 近 30 天生效情况（v8.5.0）：统计窗口内的任务量/节流次数/静默条数，
 * 让「旋钮是否真的生效」可验证而不是只写在表单里。
 */
export default function EffectCard({ effect }: { effect: RepoStatsRow | null | undefined }) {
  return (
    <Panel
      bodyStyle={{ padding: t.space.md }}
      title="近 30 天生效情况"
      style={{ marginBottom: t.space.lg }}
    >
      {effect ? (
        <>
          <Row gutter={[t.space.xxl, t.space.sm]}>
            <Col xs={12} md={6}>
              <Statistic title="审查任务" value={effect.tasks_done ?? 0} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="节流跳过回帖"
                value={effect.reply_throttled ?? 0}
                suffix="次"
                styles={{
                  content: {
                    color: (effect.reply_throttled ?? 0) > 0 ? t.color.attention : undefined,
                  },
                }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="低于级别地板静默" value={effect.silenced_floor ?? 0} suffix="条" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="超出数量上限静默" value={effect.silenced_cap ?? 0} suffix="条" />
            </Col>
          </Row>
          <Typography.Text type="secondary" className="meta-sm">
            静默只影响回帖/行内意见，审查与报告仍全量执行；每份报告的尾注会列出本轮静默条数。
          </Typography.Text>
        </>
      ) : (
        <Typography.Text type="secondary">近 30 天暂无已完成审查任务。</Typography.Text>
      )}
    </Panel>
  )
}
