# ৭ এয়ার ট্রাভেলস — K50A উপস্থিতি সিস্টেম  
## সম্পূর্ণ বাংলা ব্যবহার নির্দেশিকা

---

## ⭐ ৩ মিনিটে বুঝুন (সবচেয়ে গুরুত্বপূর্ণ)

### প্রশ্ন: ওয়েবসাইটে employee add করলে K50A কীভাবে জানে?

**উত্তর: জানে না।** ওয়েবসাইট K50A-তে কাউকে পাঠায় না।  
আপনাকে **দুই জায়গায় আলাদা কাজ** করতে হবে, শুধু **একটা নম্বর** দিয়ে যুক্ত করতে হবে।

### উদাহরণ — কর্মচারী “রহিম”

| ধাপ | কোথায় | কী করবেন |
|-----|--------|----------|
| ১ | **K50A মেশিন** | আঙুলের ছাপ নিন + User ID দিন → `1001` |
| ২ | **Admin (Employee records)** | নাম “রহিম”, ফোন, বিভাগ + **K50A User ID = `1001`** |
| ৩ | **K50A মেশিন** | রহিম আঙুল দিল → মেশিন পাঠায় “User 1001 scanned” |
| ৪ | **ওয়েবসাইট** | `1001` খুঁজে “রহিম” পায় → attendance save |

```
K50A-তে fingerprint + User ID 1001
              ↓
ওয়েবসাইটে নাম + K50A User ID 1001  (একই নম্বর!)
              ↓
Scan → ওয়েবসাইট attendance “রহিম” নামে দেখায়
```

### ❌ ভুল ধারণা

| ভুল | সত্যি |
|-----|-------|
| “Employee records-এ add করলেই K50A-তে user তৈরি হবে” | **না** — K50A-তে আলাদা enroll করতে হবে |
| “ওয়েব থেকে fingerprint দেওয়া যায়” | **না** — fingerprint শুধু K50A-তে |
| “নাম মিললেই চলবে” | **না** — **User ID নম্বর** মিলতে হবে |

### ✅ সঠিক ক্রম

1. **আগে** K50A-তে fingerprint + User ID  
2. **তারপর** admin ওয়েবসাইটে employee record + **একই User ID**  
3. **Sync** (অটো প্রতি ৩০ সেক.) বা **Sync now** চাপুন  

---

## ⭐ কে ওয়েবসাইট use করবে? (Admin vs Employee)

| কে | K50A মেশিন | ATFS ওয়েবসাইট |
|----|------------|----------------|
| **সাধারণ কর্মচারী** | ✅ আঙুল scan | ❌ **login/use করে না** |
| **Admin (HR/Manager)** | ❌ (ঐচ্ছিক) | ✅ login করে manage করে |

**গুরুত্বপূর্ণ:**
- কর্মচারীদের **কোনো login/password নেই** — ওয়েবসাইটে employee portal নেই।
- ওয়েবসাইট = **শুধু admin console** (SUPER_ADMIN, ADMIN, VIEWER)।
- Admin **Employee records** পেজে কর্মচারীর **তথ্য রাখে** — কর্মচারী নিজে ওয়েব open করে না।
- কর্মচারী শুধু **K50A-তে আঙুল দেয়** — attendance admin dashboard-এ দেখে।

```
কর্মচারী  →  K50A scan only
Admin     →  Vercel website (login) → attendance দেখা/সংশোধন
```

---

## এই গাইডে কী আছে?

1. K50A অফিস নেটওয়ার্কে সংযোগ  
2. K50A ও ওয়েবসাইট (ATFS) যুক্ত করা  
3. Fingerprint কোথায় এনরোল করবেন  
4. ওয়েবসাইটে কর্মচারী যোগ করা  
5. দৈনিক রেজিস্টার দেখা / সংশোধন  
6. অ্যাডমিন role ও অ্যাক্সেস  

---

## শব্দের সহজ অর্থ

| শব্দ | সহজ বাংলায় |
|------|-------------|
| **K50A** | অফিসের fingerprint মেশিন (LAN/Ethernet) |
| **ওয়েবসাইট (ATFS)** | **Admin-only** dashboard — attendance manage; কর্মচারী login করে না |
| **K50A User ID** | মেশিনে user তৈরি করার সময় যে নম্বর (যেমন `1001`) — Employee records-এ **একই নম্বর** দিন |
| **Fingerprint** | আঙুলের ছাপ — **শুধু K50A-তে**, ওয়েবে নয় |
| **Sync** | K50A থেকে লগ টেনে ওয়েবসাইট DB-তে আনা |
| **Daily register** | প্রতিদিন Present / Late / Absent সারাংশ |

---

# অংশ ১: K50A হার্ডওয়্যার ও নেটওয়ার্ক সেটআপ

## ধাপ ১.১ — K50A ফিজিক্যাল সংযোগ

1. K50A টার্মিনালটি টেবিল/দেয়ালে স্থাপন করুন।  
2. **Ethernet (LAN) কেবল** দিয়ে অফিস **রাউটার বা নেটওয়ার্ক সুইচ**-এর সাথে সংযুক্ত করুন।  
3. K50A-তে Wi‑Fi বা 4G **ধরে নেওয়া হয় নি** — শুধু LAN/Ethernet।  
4. পাওয়ার অন করুন।  

## ধাপ ১.২ — K50A-তে IP ঠিক করা

K50A ডিভাইসের মেনু থেকে (মডেল অনুযায়ী মেনু নাম ভিন্ন হতে পারে):

1. **Menu → Communication → TCP/IP** (বা Network)  
2. নিচের মতো সেট করুন:

| সেটিং | উদাহরণ | নোট |
|--------|---------|-----|
| IP Address | `192.168.1.201` | Static IP দিন — DHCP বদলালে সমস্যা হতে পারে |
| Subnet Mask | `255.255.255.0` | রাউটার অনুযায়ী |
| Gateway | `192.168.1.1` | রাউটার IP |
| Port | `4370` | ZKTeco-তে সাধারণ পোর্ট — **আপনার ডিভাইসে যা আছে সেটাই ব্যবহার করুন** |

3. সেভ করুন।  

## ধাপ ১.৩ — নেটওয়ার্ক টেস্ট

যে PC/সার্ভারে ATFS চলবে, সেটি **একই LAN**-এ থাকতে হবে:

```text
ping 192.168.1.201
```

- **Reply পেলে** → LAN ঠিক আছে  
- **Timeout** → কেবল/সুইচ/IP/VLAN চেক করুন  

## ধাপ ১.৪ — নিরাপত্তা (অবশ্যই)

- K50A-র TCP পোর্ট (**4370**) **ইন্টারনেটে খুলবেন না**  
- শুধু অফিস LAN বা VPN দিয়ে সার্ভার K50A-তে পৌঁছাবে  
- ওয়েবসাইট HTTPS দিয়ে চালান (production-এ)  

---

# অংশ ২: ATFS ওয়েবসাইট চালু করা

## ধাপ ২.১ — প্রথমবার সেটআপ

```powershell
cd e:\7airtravels_atfs
npm install
npm run db:setup
npm run db:seed:admin
npm run dev:all
```

ব্রাউজার: **http://localhost:3000**

| লগইন | মান |
|-------|-----|
| Email | `admin@7airtravels.local` |
| Password | `.env` ফাইলের `ADMIN_BOOTSTRAP_PASSWORD` |

প্রথম লগইনের পর: **My account → Change password**

## ধাপ ২.২ — দুটি প্রসেস চলতে হবে

| প্রসেস | কাজ | পোর্ট |
|--------|-----|-------|
| Web (`npm run dev`) | ড্যাশবোর্ড + API | 3000 |
| Worker (`npm run dev:worker`) | K50A থেকে sync + live update | 3001 |

`npm run dev:all` দুটো একসাথে চালায়।  

---

# অংশ ৩: K50A ও ওয়েবসাইট সংযোগ (বিস্তারিত)

## ধাপ ৩.১ — ডিভাইস ওয়েবে যোগ করা

1. লগইন করুন  
2. বাম মেনু → **K50A Devices**  
3. ডান পাশে **Add device** ফর্ম:

| ফিল্ড | কী দেবেন |
|-------|----------|
| Name | `K50A-001` |
| Adapter | `k50a` (আসল ডিভাইস) / `mock` (টেস্ট) |
| IP address | K50A-র IP, যেমন `192.168.1.201` |
| TCP port | `4370` (বা ডিভাইসে যা সেট) |
| Location | `Main Office` |

4. **Save device**  

## ধাপ ৩.২ — সংযোগ পরীক্ষা (Test Connection)

1. তালিকায় **K50A-001**-এ ক্লিক  
2. **Test connection** চাপুন  

**ফলাফল:**

| ফলাফল | অর্থ |
|--------|------|
| ✓ K50A connected successfully | TCP + প্রোটোকল handshake ঠিক |
| TCP reachable, handshake failed | IP/পোর্ট ঠিক, কিন্তু লাইব্রেরি/ফার্মওয়্যার মিলছে না — IT-কে জানান |
| Connection refused / timeout | IP, কেবল, ফায়ারওয়াল, VLAN চেক |

## ধাপ ৩.৩ — ডিভাইস তথ্য ও ইউজার দেখা

একই ডায়াগনostic পেজে:

| বাটন | কাজ |
|-------|-----|
| **Get info** | ইউজার সংখ্যা, লগ সংখ্যা |
| **Read users** | K50A-তে এনরোল করা ইউজার তালিকা |
| **Read transactions** | সাম্প্রতিক উপস্থিতি লগ |
| **Sync now** | সব লগ Neon DB-তে টানা (duplicate হবে না) |

## ধাপ ৩.৪ — স্বয়ংক্রিয় Sync

Worker প্রতি **৩০ সেকেন্ড**ে (`.env`-এ `SYNC_INTERVAL_MS`) K50A থেকে নতুন লগ নেয়।  
ইন্টারনেট/সার্ভার বন্ধ থাকলে K50A-তে লগ থাকে — পরে Sync হলে সব চলে আসে।  

## ধাপ ৩.৫ — `.env`-এ K50A (ঐচ্ছিক)

```env
K50A_IP=192.168.1.201
K50A_PORT=4370
DEVICE_ADAPTER=k50a
SIMULATION_MODE=false
```

---

# অংশ ৪: কর্মচারী ও Fingerprint — সম্পূর্ণ প্রক্রিয়া

## দুটো জায়গা, একটা নম্বর

```
┌──────────────────────┐              ┌──────────────────────┐
│      K50A মেশিন       │              │   ATFS ওয়েবসাইট     │
├──────────────────────┤              ├──────────────────────┤
│ ✓ Fingerprint নিন    │              │ ✓ নাম, ফোন, বিভাগ    │
│ ✓ User ID দিন (1001) │  ←── 1001 ──→ │ ✓ K50A User ID: 1001 │
│ ✗ ওয়েব থেকে control │              │ ✗ Fingerprint নেই    │
└──────────────────────┘              └──────────────────────┘
         ↑                                        ↑
    আপনি এখানে enroll করেন              আপনি এখানে profile রাখেন
```

**মনে রাখুন:** Employee records-এ create = ওয়েব DB-তে save। K50A **automatic জানে না**।  
যোগাযোগের একমাত্র চাবি = **K50A User ID নম্বর**।  
অ্যাডমিন ওয়েবসাইট থেকে fingerprint এনরোল করতে **পারে না**।

## ধাপ ৪.১ — K50A-তে নতুন ইউজার + Fingerprint (আগে এটা)

K50A ডিভাইস মেনু (মডেল ভিন্ন হতে পারে):

1. **Menu → User Management → New User**  
2. **User ID** দিন — সংখ্যা, যেমন `1001`, `1002` … (এটাই **Device User ID**)  
3. ডিভাইসে ছোট নাম দিতে পারেন (ঐচ্ছিক)  
4. **Enroll Fingerprint** → কর্মচারী ২–৩ বার আঙুল রাখুন  
5. সেভ করুন  

**উদাহরণ:** Test Employee → Device User ID = `1001`

## ধাপ ৪.২ — ওয়েবসাইটে কর্মচারী যোগ করা (তারপর এটা)

1. **Employee records** মেনু  
2. ডানে **Add employee**:

| ফিল্ড | উদাহরণ | বাধ্যতামূলক | নোট |
|-------|---------|-------------|-----|
| Code | `EMP001` | হ্যাঁ | অফিসের internal ID |
| Name | `রহিম উদ্দিন` | হ্যাঁ | Dashboard-এ এ নাম দেখাবে |
| Phone | `017XXXXXXXX` | না | SMS-এর জন্য |
| **K50A User ID** | `1001` | **হ্যাঁ** | K50A-র User ID-র **হুবহু** একই |
| Department | Operations | না | |
| Designation | Officer | না | |

3. **Create employee**  

> **সতর্ক:** K50A User ID `1001` দিলেন কিন্তু K50A-তে enroll করেননি → scan করলে **unknown user** দেখাবে।  
> **সতর্ক:** K50A-তে `1001`, ওয়েবে `2001` → attendance **ভুল বা unknown**।

## ধাপ ৪.৩ — মিল যাচাই (checklist)

- [ ] K50A Devices → **Read users** → `1001` আছে?  
- [ ] Employee records → Device UID column-এ `1001` আছে?  
- [ ] Employee status = **ACTIVE**?  
- [ ] Worker চলছে বা **Sync now** চাপেছেন?  
- [ ] Test scan → Dashboard live feed-এ **নাম** আসে?  

## ধাপ ৪.৩.১ — সমস্যা হলে

| লক্ষণ | কারণ | সমাধান |
|--------|------|--------|
| Scan হয়, নাম আসে না | User ID মিলেনি | Employee records-এ K50A User ID ঠিক করুন |
| Read users-এ নেই | K50A-তে enroll হয়নি | K50A-তে New User + Fingerprint |
| পুরনো scan আসে না | Sync হয়নি | Sync now / Worker চালু আছে কিনা দেখুন |

## ধাপ ৪.৪ — কর্মচারী সম্পাদনা / নিষ্ক্রিয়

1. **Employee records** → নামে ক্লিক  
2. নাম, ফোন, Device User ID, Status (ACTIVE/INACTIVE) বদল  
3. **Save**  
4. **Deactivate** = কাজ থেকে সরানো (ডিলিট নয়, ইতিহাস থাকে)  

---

# অংশ ৫: উপস্থিতি প্রবাহ (End-to-End)

```
কর্মচারী আঙুল দেয় (K50A)
        ↓
K50A লোকাল লগ সেভ
        ↓
Worker / Sync now → Neon PostgreSQL
        ↓
Employee match (deviceUserId)
        ↓
Daily register + Dashboard live
        ↓
SMS (৩ অ্যাডমিন নম্বর, SMS মেনুতে Enable)
```

## Dashboard (Operations)

- আজ Present / Late / Absent / Leave  
- Live attendance feed  
- K50A status ও last sync  

---

# অংশ ৬: দৈনিক রেজিস্টার (Daily Register)

**মেনু:** Attendance  

## দেখা (সব Role)

1. From / To তারিখ  
2. Status ফিল্টার (ঐচ্ছিক)  
3. **Apply**  

## সংশোধন (ADMIN + SUPER_ADMIN)

1. সারিতে **Edit**  
2. বদল করুন: Status, Check-in, Check-out, Notes, Late/Early/OT minutes  
3. **Save**  

## মুছে ফেলা (ADMIN + SUPER_ADMIN)

1. **Delete** → নিশ্চিত করুন  
2. শুধু **দৈনিক সারাংশ** মুছে — K50A-র raw fingerprint লগ DB-তে থাকতে পারে  

## নতুন এন্ট্রি (ADMIN + SUPER_ADMIN)

1. **Add entry**  
2. Employee, Date, Status, সময়  
3. ছুটি/ম্যানুয়াল সংশোধনের জন্য  

**VIEWER** শুধু দেখতে পারে — Edit/Delete/Add নয়।  

---

# অংশ ৭: SMS (৩ অ্যাডমিন) — BulkSMSBD

1. **Admin SMS** মেনু  
2. Enable SMS notifications ✓  
3. Admin SMS Number 1, 2, 3 (যেমন `017XXXXXXXX` বা `88017XXXXXXXX`)  
4. Save  
5. **Test** দিয়ে গেটওয়ে চেক  

`.env` / Vercel:

```env
SMS_PROVIDER=bulksmsbd
SMS_API_URL=http://bulksmsbd.net/api/smsapi
SMS_API_KEY=your-api-key
SMS_SENDER_ID=8809648910591
SMS_TYPE=text
SMS_API_METHOD=GET
```

সফল হলে API response code **202**। Balance কম হলে `1007` আসবে।  
IP whitelist চাইলে BulkSMSBD dashboard থেকে Vercel/Worker IP allow করুন (`1032`).  

---

# অংশ ৮: Shift ও নিয়ম

**Shifts** মেনু:

| সেটিং | ডিফল্ট |
|--------|---------|
| Office start | 09:00 |
| Late after | 09:15 |
| Office end | 18:00 |

এগুলো hardcode নয় — অ্যাডমিন এখান থেকে বদলাতে পারেন।  

---

# অংশ ৯: Role ও অ্যাক্সেস তালিকা

| কাজ | SUPER_ADMIN | ADMIN | VIEWER |
|-----|:-----------:|:-----:|:------:|
| Dashboard দেখা | ✓ | ✓ | ✓ |
| Attendance দেখা | ✓ | ✓ | ✓ |
| Attendance Edit/Delete/Add | ✓ | ✓ | ✗ |
| Employee records (admin) | ✓ | ✓ | ✗ |
| K50A Devices + Sync | ✓ | ✓ | ✗ |
| Reports + Export | ✓ | ✓ | ✓ |
| SMS Settings | ✓ | ✓ | ✗ |
| Shifts / Holidays / Leave | ✓ | ✓ | ✗ |
| Audit Log | ✓ | ✗ | ✗ |
| My account (পাসওয়ার্ড) | ✓ | ✓ | ✓ |
| Simulation | ✓ | ✓ | ✗ |

---

# অংশ ১০: সমস্যা সমাধান

| সমস্যা | সমাধান |
|--------|---------|
| লগইন হয় না | `npm run db:seed:admin` চালান; email/password `.env` দেখুন |
| K50A connect হয় না | ping, IP, port, একই LAN |
| আঙুল দিলাম, নাম আসে না | Device User ID মিলেছে? Employee ACTIVE? Sync now? |
| Duplicate attendance | স্বাভাবিক — সিস্টেম duplicate insert করে না |
| SMS যায় না | SMS Enable? ৩ নম্বর? Provider credentials? |

---

# অংশ ১১: ফিচার চেকলিস্ট (সিস্টেমে আছে কিনা)

| ফিচার | স্ট্যাটাস | কোথায় |
|--------|----------|--------|
| K50A IP/Port সেট | ✓ | K50A Devices |
| Test Connection | ✓ | Device diagnostic |
| Sync attendance | ✓ | Sync now / Worker |
| Fingerprint on device | ✓ | K50A মেনু (ওয়েব নয়) |
| Employee add/edit (admin) | ✓ | Employee records |
| Device User ID map | ✓ | Employee records |
| Daily register view | ✓ | Attendance |
| Daily register edit | ✓ | Attendance → Edit |
| Daily register delete | ✓ | Attendance → Delete |
| Manual entry add | ✓ | Attendance → Add entry |
| Admin password change | ✓ | My account |
| Bangla guide | ✓ | বাংলা গাইড মেনু |
| Role-based access | ✓ | SUPER_ADMIN / ADMIN / VIEWER |

---

**৭ এয়ার ট্রাভেলস লিমিটেড — ATFS**  
সহায়তার জন্য: `docs/K50A.md` (ইংরেজি টেকনিক্যাল) ও এই ফাইল।  
