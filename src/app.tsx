import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger, scopedStorage } from "@lark-apaas/client-toolkit-lite";
import { Layout } from "@/components/Layout";
import LauncherPage from "@/pages/LauncherPage/LauncherPage";
import HomePage from "@/pages/HomePage/HomePage";
import SearchPage from "@/pages/SearchPage/SearchPage";
import ShopDetailPage from "@/pages/ShopDetailPage/ShopDetailPage";
import CheckoutPage from "@/pages/CheckoutPage/CheckoutPage";
import OrderTrackPage from "@/pages/OrderTrackPage/OrderTrackPage";
import OrderListPage from "@/pages/OrderListPage/OrderListPage";
import ProfilePage from "@/pages/ProfilePage/ProfilePage";
import CouponPage from "@/pages/CouponPage/CouponPage";
import ReviewPage from "@/pages/ReviewPage/ReviewPage";
import LoginPage from "@/pages/LoginPage/LoginPage";
import SettingsPage from "@/pages/SettingsPage/SettingsPage";
import HelpPage from "@/pages/HelpPage/HelpPage";
import ShopInfoPage from "@/pages/ShopInfoPage/ShopInfoPage";
import MerchantHomePage from "@/pages/merchant/MerchantHomePage";
import MerchantOrdersPage from "@/pages/merchant/MerchantOrdersPage";
import MerchantDishesPage from "@/pages/merchant/MerchantDishesPage";
import MerchantShopPage from "@/pages/merchant/MerchantShopPage";
import MerchantReviewsPage from "@/pages/merchant/MerchantReviewsPage";
import MerchantMessagesPage from "@/pages/merchant/MerchantMessagesPage";
import MerchantNotificationsPage from "@/pages/merchant/MerchantNotificationsPage";
import MerchantMarketingPage from "@/pages/merchant/MerchantMarketingPage";
import MerchantFinancePage from "@/pages/merchant/MerchantFinancePage";
import MerchantSettingsPage from "@/pages/merchant/MerchantSettingsPage";
import MerchantCreateShopPage from "@/pages/merchant/MerchantCreateShopPage";
import RiderHomePage from "@/pages/rider/RiderHomePage";
import RiderHallPage from "@/pages/rider/RiderHallPage";
import RiderTasksPage from "@/pages/rider/RiderTasksPage";
import RiderRecordPage from "@/pages/rider/RiderRecordPage";
import RiderMessagesPage from "@/pages/rider/RiderMessagesPage";
import RiderNotificationsPage from "@/pages/rider/RiderNotificationsPage";
import RiderSettingsPage from "@/pages/rider/RiderSettingsPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import PaymentPage from "@/pages/PaymentPage/PaymentPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage/PaymentSuccessPage";
import MemberCenterPage from "@/pages/MemberCenterPage/MemberCenterPage";
import CouponCenterPage from "@/pages/CouponCenterPage/CouponCenterPage";
import AvatarEditPage from "@/pages/AvatarEditPage/AvatarEditPage";
import ChatPage from "@/pages/ChatPage/ChatPage";
import MessageCenterPage from "@/pages/MessageCenterPage/MessageCenterPage";
import NotificationCenterPage from "@/pages/NotificationCenterPage/NotificationCenterPage";
import { MerchantLayout } from "@/components/MerchantLayout";
import { RiderLayout } from "@/components/RiderLayout";

import { AuthProvider } from "@/hooks/useAuth";
import { WalletProvider } from "@/hooks/useWallet";
import { NotificationProvider } from "@/hooks/useNotifications";
import { useNavigationStack } from "@/hooks/useNavigationStack";

function StackProvider() {
  useNavigationStack();
  return <></>;
}

const THEME_KEY = 'food_delivery_theme'

function initTheme() {
  const saved = scopedStorage.getItem(THEME_KEY)
  if (saved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export default function App() {
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <AuthProvider>
      <WalletProvider>
        <NotificationProvider>
        <StackProvider />
        <div className="mx-auto max-w-md h-screen min-h-[640px] bg-background relative overflow-hidden">
          <ErrorBoundary
            FallbackComponent={({ resetErrorBoundary }) => (
              <div className="flex flex-col w-full min-h-[500px] items-center justify-center gap-3 px-8 py-16 bg-background">
                <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="size-7 text-destructive" />
                </div>
                <p className="text-base font-medium text-foreground">页面加载失败</p>
                <p className="text-sm text-muted-foreground text-center">
                  页面内容加载异常，点击重试可恢复正常
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetErrorBoundary}
                  className="mt-2 gap-1.5"
                >
                  <RefreshCw className="size-4" />
                  点击重试
                </Button>
              </div>
            )}
            onError={(error) => {
              logger.error('Global App ErrorBoundary caught:', String(error))
            }}
          >
         <Routes>
          {/* 启动选择器（根路径） */}
          <Route index element={<LauncherPage />} />

          {/* 顾客端（独立 Layout + TabBar） */}
          <Route path="customer" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="orders" element={<OrderListPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="shop/:id" element={<ShopDetailPage />} />
            <Route path="shop-info/:id" element={<ShopInfoPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="order/:id/track" element={<OrderTrackPage />} />
            <Route path="coupons" element={<CouponPage />} />
            <Route path="member" element={<MemberCenterPage />} />
            <Route path="coupon-center" element={<CouponCenterPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="avatar-edit" element={<AvatarEditPage />} />
            <Route path="messages" element={<MessageCenterPage role="customer" />} />
            <Route path="notifications" element={<NotificationCenterPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>

          {/* 登录页（带 role 参数：?role=customer|merchant|rider） */}
          <Route path="login" element={<LoginPage />} />

          {/* 商家创建店铺页（建店向导，不在 MerchantLayout 内） */}
          <Route path="merchant/create-shop" element={<MerchantCreateShopPage />} />

          {/* 通用聊天页 */}
          <Route path="chat" element={<ChatPage />} />

          {/* 支付页（通用，非 Tab 栈内） */}
          <Route path="payment" element={<PaymentPage />} />
          <Route path="payment/success" element={<PaymentSuccessPage />} />

          {/* 商家端（独立 Layout + TabBar） */}
          <Route path="merchant" element={<MerchantLayout />}>
            <Route index element={<MerchantHomePage />} />
            <Route path="orders" element={<MerchantOrdersPage />} />
            <Route path="dishes" element={<MerchantDishesPage />} />
            <Route path="shop" element={<MerchantShopPage />} />
            <Route path="messages" element={<MerchantMessagesPage />} />
            <Route path="notifications" element={<MerchantNotificationsPage />} />
            <Route path="reviews" element={<MerchantReviewsPage />} />
            <Route path="settings" element={<MerchantSettingsPage />} />
            <Route path="marketing" element={<MerchantMarketingPage />} />
            <Route path="finance" element={<MerchantFinancePage />} />
          </Route>

          {/* 骑手端（独立 Layout + TabBar） */}
          <Route path="rider" element={<RiderLayout />}>
            <Route index element={<RiderHomePage />} />
            <Route path="hall" element={<RiderHallPage />} />
            <Route path="tasks" element={<RiderTasksPage />} />
            <Route path="messages" element={<RiderMessagesPage />} />
            <Route path="notifications" element={<RiderNotificationsPage />} />
            <Route path="record" element={<RiderRecordPage />} />
            <Route path="settings" element={<RiderSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ErrorBoundary>
        <Toaster
          position="bottom-center"
          richColors
          closeButton={false}
          duration={2000}
          toastOptions={{
            style: { pointerEvents: 'none' } as React.CSSProperties,
            classNames: {
              toast: 'pointer-events-none',
            },
          }}
          style={{ bottom: '80px' } as React.CSSProperties}
        />
      </div>
        </NotificationProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
