import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface AgreementSheetProps {
  open: boolean
  type: 'user' | 'privacy'
  onClose: () => void
}

const AGREEMENTS: Record<string, { title: string; content: string[] }> = {
  user: {
    title: '用户协议',
    content: [
      '欢迎使用饭否外卖服务。本协议是您与饭否外卖平台之间关于使用本服务所订立的协议。请您仔细阅读以下全部内容。',
      '一、账号注册与使用',
      '1. 您在使用本服务时需要注册一个账号。您应当提供真实、准确、完整的个人信息，并在信息发生变更时及时更新。',
      '2. 您应妥善保管账号和密码，因您保管不当造成的损失由您自行承担。',
      '3. 您理解并同意，饭否外卖有权根据业务发展需要对服务内容进行调整、变更或中止。',
      '二、服务规范',
      '1. 您承诺不会利用本服务从事任何违反法律法规及社会公德的行为。',
      '2. 您不得发布或传播任何违法、违规、侵权的信息。',
      '3. 您不得干扰或破坏本服务的正常运行。',
      '三、交易规则',
      '1. 您通过本平台下单即视为您与商家之间建立了买卖合同关系。',
      '2. 订单价格、配送费用等以平台展示为准。',
      '3. 如遇商家缺货、配送异常等情况，平台将协助您处理。',
      '四、免责声明',
      '1. 因不可抗力或非平台原因导致的服务中断，平台不承担责任。',
      '2. 商家提供的商品质量问题由商家承担相应责任。',
      '五、协议变更',
      '平台有权根据需要随时修改本协议内容，修改后的协议将在平台上公布。',
    ],
  },
  privacy: {
    title: '隐私政策',
    content: [
      '饭否外卖非常重视您的个人信息保护。本隐私政策将帮助您了解我们如何收集、使用和保护您的个人信息。',
      '一、信息收集',
      '1. 注册信息：当您注册账号时，我们会收集您的手机号、昵称等信息。',
      '2. 订单信息：为了完成配送，我们会收集您的收货地址、联系电话等信息。',
      '3. 位置信息：为了提供附近的商家推荐和配送服务，我们可能会收集您的位置信息。',
      '4. 设备信息：我们可能会收集您的设备型号、操作系统等信息，用于优化服务体验。',
      '二、信息使用',
      '1. 我们会将收集的信息用于提供、维护和改进我们的服务。',
      '2. 我们会使用您的信息处理订单、配送商品、提供客服支持。',
      '3. 经您同意，我们可能会向您发送营销信息。',
      '三、信息保护',
      '1. 我们采用业界通用的安全技术和管理措施保护您的个人信息。',
      '2. 我们不会未经您的同意向第三方共享您的个人信息，法律法规要求的除外。',
      '四、您的权利',
      '1. 您有权访问、更正、删除您的个人信息。',
      '2. 您可以随时撤回对个人信息收集使用的同意。',
      '五、联系我们',
      '如您对本隐私政策有任何疑问，欢迎通过平台客服与我们联系。',
    ],
  },
}

export default function AgreementSheet({ open, type, onClose }: AgreementSheetProps) {
  const data = AGREEMENTS[type]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩 */}
          <motion.div
            key="mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50 max-w-md mx-auto"
            onClick={onClose}
          />
          {/* 弹层 */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[75vh] bg-card rounded-t-2xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 h-12 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
              <button
                onClick={onClose}
                className="size-8 flex items-center justify-center text-muted-foreground"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
            </div>
            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
              {data.content.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
