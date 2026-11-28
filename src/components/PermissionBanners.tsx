/**
 * 治理页共用的权限提示：无裁定权限说明 + 403 拒绝说明。
 * 三条横幅（修复审批 / 合并资格门 / 受控推送）此前各抄一份，文案与语义一致。
 */
import { Alert } from 'antd'
import { useAuth } from '../auth/AuthContext'

export function PermissionBanners({
  canDecide,
  forbidden,
}: {
  /** 是否具备业务裁定权限。为 false 时才提示「无权限」——不能无条件渲染。 */
  canDecide: boolean
  /** 服务端是否已拒绝过（403）。 */
  forbidden: boolean
}) {
  const { user } = useAuth()
  return (
    <>
      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="当前账号无业务裁定权限"
          description={`审批/合并/推送属于 maintainer 角色；当前角色为 ${user?.role || '—'}。read 档仍可查看审查结果与报告。`}
        />
      )}
      {forbidden && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="请求被拒绝（403）"
          description="该接口要求 admin 档 + 业务裁定角色（maintainer）。平台 admin 刻意无裁定权，防止平台管理员越权改码。"
        />
      )}
    </>
  )
}

/**
 * 无裁定权限时的统一判定。
 * 静态超管 token 无 permissions 投影时按可裁定处理（与侧栏可见性一致），
 * 服务端仍二次判定；不一致以服务端为准。
 */
export function useCanDecide(): boolean {
  const { user, can } = useAuth()
  if (!user?.permissions) return true
  return can('decide_review')
}
