import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Mail, Building2, User } from "lucide-react";

export default function Legal() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold text-white font-syne">
            Astro Orb
          </h1>
          <p className="text-lg text-purple-200">
            Юридическая информация и реквизиты
          </p>
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="w-5 h-5" />
              Информация о продавце
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-purple-100">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 mt-0.5 text-purple-300" />
                <div>
                  <p className="font-medium text-white">Самозанятый</p>
                  <p className="text-sm">Садаев Алексей Сергеевич</p>
                  <p className="text-xs text-purple-300 mt-1">
                    Статус плательщика НПД (налог на профессиональный доход)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-0.5 text-purple-300" />
                <div>
                  <p className="font-medium text-white">ИНН</p>
                  <p className="text-sm font-mono">026819831820</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 mt-0.5 text-purple-300" />
                <div>
                  <p className="font-medium text-white">Email поддержки</p>
                  <p className="text-sm">alekseysadaev1@gmail.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Описание услуг</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-100 space-y-3">
            <p>
              <strong className="text-white">Astro Orb</strong> — это Telegram Mini App для получения
              персонализированных астрологических консультаций с использованием искусственного интеллекта.
            </p>
            
            <div className="space-y-2">
              <p className="font-medium text-white">Предоставляемые услуги:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Построение натальной карты (бесплатно)</li>
                <li>AI-интерпретация астрологических данных</li>
                <li>Анализ совместимости с партнёром</li>
                <li>Персональные гороскопы (дневные, недельные, месячные)</li>
                <li>Солнечные возвращения и транзиты</li>
                <li>Подписки на расширенные функции</li>
              </ul>
            </div>

            <p className="text-sm mt-4">
              Все услуги предоставляются в электронном виде через интерфейс Telegram Mini App.
              Платежи принимаются через систему ЮKassa.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Политика возврата</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-100 text-sm space-y-2">
            <p>
              Возврат средств возможен в течение 14 дней с момента оплаты при условии,
              что услуга не была использована в полном объёме.
            </p>
            <p>
              Для запроса возврата свяжитесь с поддержкой по указанному email.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-purple-300 text-sm">
          <p>© 2025 Astro Orb. Все права защищены.</p>
        </div>
      </div>
    </div>
  );
}
