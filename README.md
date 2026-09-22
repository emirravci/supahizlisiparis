# SupaFastSale 🛠️
### Nalbur & Hırdavat Stok Takip, Hızlı Satış (POS), Cari & Proforma Teklif Sistemi

Modern, endüstriyel tasarıma sahip, tam responsive (mobil, tablet ve masaüstü uyumlu) web tabanlı nalbur ve hırdavat yönetim uygulaması.

---

## 🚀 Özellikler

- 📊 **Dükkan Durumu (Dashboard):** 4 temel sayaç (toplam ürün, toplam stok, kritik stok alarmı, günlük ciro), kritik stok seviyesine düşen malzemeler için anlık alarm listesi.
- 🛒 **Hızlı Tezgah Satışı (Kasa / POS):** Barkod veya isimle arama, kategori hapları, sepet, adet kontrolleri ve tek tıkla stoktan düşerek satış tamamlama.
- 🏷️ **Çoklu Fiyat Listeleri (Tarifeler):** Standart Perakende, Toptan, Usta & Sanayi Özel Fiyatı, Şantiye Proje Fiyatı ve Kampanya listeleri tanımlama.
- 👥 **Cari Hesap Yönetimi:** Müşteri ve toptancı tedarikçi kartları, adres/vergi bilgileri, borç/alacak bakiye takibi.
- 📄 **Sipariş & Teklif (Proforma Fatura):** Müşteriye özel teklif hazırlama, A4 resmi proforma fatura çıktısı / PDF kaydetme, tek tıkla WhatsApp'tan teklif gönderme ve teklifi tek tuşla satışa dönüştürme.
- 📖 **Sosyal Medya Dijital Katalog Oluşturucu:** Seçilen ürünlerle Instagram, Facebook ve WhatsApp durumu için fiyatlı kampanya afişi üretme ve WhatsApp bülten metni kopyalama.
- ⏱️ **Stok Hareket Geçmişi:** Giriş, satış, fire ve sayım düzeltme hareketlerinin tarihçeli dökümü.

---

## 🌐 GitHub Pages Kurulumu (30 Saniye)

Bu proje **saf HTML5, CSS3 ve Vanilla JavaScript (ES Modules)** ile geliştirilmiştir. Hiçbir Node.js kurulumu veya derleme (build) işlemi gerektirmez.

1. Bu depoyu GitHub hesabınıza push edin.
2. Deponuzun **Settings > Pages** sekmesine gidin.
3. **Build and deployment > Branch** kısmından `main` (veya `master`) ve `/ (root)` seçeneğini belirleyip **Save** butonuna tıklayın.
4. Birkaç saniye içinde siteniz `https://kullaniciadi.github.io/depo-adi/` adresinde canlıya geçecektir!

---

## 🗄️ Veritabanı Kurulumu (Supabase)

1. [Supabase](https://supabase.com) üzerinde ücretsiz bir proje oluşturun.
2. Projedeki **`schema.sql`** dosyasının tamamını kopyalayıp Supabase **SQL Editor** ekranına yapıştırın ve **Run** butonuna basın.
3. Supabase **Authentication > Users** ekranından dükkanınız için bir kullanıcı (e-posta ve şifre) oluşturun.
4. Sitenizi açıp oluşturduğunuz bilgilerle hemen giriş yapın!
