# ৭ এয়ার ট্রাভেলস — K50A উপস্থিতি সিস্টেম  
## সম্পূর্ণ বাংলা ব্যবহার নির্দেশিকা

এই ডকুমেন্টে ধাপে ধাপে বর্ণনা করা হয়েছে:

1. K50A ডিভাইস অফিস নেটওয়ার্কে কীভাবে সংযোগ করবেন  
2. K50A কীভাবে ওয়েবসাইট (ATFS) এর সাথে যুক্ত করবেন  
3. কর্মচারীর আঙুলের ছাপ (Fingerprint) কোথায় ও কীভাবে যোগ করবেন  
4. ওয়েবসাইটে কর্মচারীর নাম ও বিস্তারিত কীভাবে রাখবেন  
5. দৈনিক রেজিস্টার দেখা, সংশোধন ও মুছে ফেলা  
6. কোন অ্যাডমিন কী কী করতে পারবেন  

---

## গুরুত্বপূর্ণ ধারণা (একবার পড়ুন)

| বিষয় | ব্যাখ্যা |
|--------|----------|
| **K50A** | অফিসের ফিঙ্গারপ্রিন্ট মেশিন — Ethernet দিয়ে LAN-এ থাকে |
| **ওয়েবসাইট (ATFS)** | অ্যাডমিন ড্যাশবোর্ড — Neon PostgreSQL ডাটাবেস ব্যবহার করে |
| **Device User ID** | K50A-তে যে নম্বর দিয়ে ইউজার তৈরি (যেমন `1001`) — ওয়েবসাইটে অবশ্যই একই নম্বর দিতে হবে |
| **আঙুলের ছাপ** | শুধু K50A ডিভাইসে এনরোল হয় — **অ্যাডমিন ওয়েব থেকে আঙুল যোগ করতে পারে না** (নিরাপত্তার জন্য) |
| **Raw punch** | K50A থেকে আসা মূল স্ক্যান লগ — সিস্টেম এটা পরিবর্তন করে না |
| **Daily register** | প্রতিদিনের সারাংশ (Present/Late/Absent ইত্যাদি) — অ্যাডমিন এটা সংশোধন/মুছতে পারে |

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

## ⚠️ গুরুত্বপূর্ণ: আঙুল কোথায় যোগ হয়?

```
┌─────────────────┐         ┌──────────────────┐
│   K50A ডিভাইস   │         │  ATFS ওয়েবসাইট  │
│  আঙুল এনরোল ✓   │         │  নাম, ফোন, বিভাগ  │
│  User ID ✓      │  ←──→   │  Device User ID  │
│  Fingerprint ✓  │         │  আঙুল ✗ (নেই)    │
└─────────────────┘         └──────────────────┘
```

**অ্যাডমিন ওয়েবসাইট থেকে আঙুলের ছাপ দেখতে বা এনরোল করতে পারে না** — এটা ZKTeco ডিভাইসের নিরাপদ পদ্ধতি।  

## ধাপ ৪.১ — K50A-তে নতুন ইউজার + Fingerprint

K50A ডিভাইস মেনু (মডেল ভিন্ন হতে পারে):

1. **Menu → User Management → New User**  
2. **User ID** দিন — সংখ্যা, যেমন `1001`, `1002` … (এটাই **Device User ID**)  
3. ডিভাইসে ছোট নাম দিতে পারেন (ঐচ্ছিক)  
4. **Enroll Fingerprint** → কর্মচারী ২–৩ বার আঙুল রাখুন  
5. সেভ করুন  

**উদাহরণ:** Test Employee → Device User ID = `1001`

## ধাপ ৪.২ — ওয়েবসাইটে কর্মচারী যোগ করা

1. **People** মেনু  
2. ডানে **Add employee**:

| ফিল্ড | উদাহরণ | বাধ্যতামূলক |
|-------|---------|-------------|
| Code | `EMP001` | হ্যাঁ |
| Name | `Test Employee` | হ্যাঁ |
| Phone | `017XXXXXXXX` | না |
| Device User ID | `1001` | **হ্যাঁ — K50A-র User ID-র সাথে ১০০% মিল** |
| Department | Operations | না |
| Designation | Officer | না |

3. **Create employee**  

## ধাপ ৪.৩ — মিল যাচাই

1. K50A Devices → **Read users** → `1001` আছে কিনা  
2. People → `1001` Device User ID আছে কিনা  
3. কর্মচারী আঙুল দিলে Dashboard live feed-এ নাম আসে কিনা  

## ধাপ ৪.৪ — কর্মচারী সম্পাদনা / নিষ্ক্রিয়

1. **People** → নামে ক্লিক  
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

# অংশ ৭: SMS (৩ অ্যাডমিন)

1. **Admin SMS** মেনু  
2. Enable SMS notifications ✓  
3. Admin SMS Number 1, 2, 3  
4. Save  
5. Test SMS দিয়ে গেটওয়ে চেক  

`.env`-এ `SMS_PROVIDER=http` ও API credentials production-এ দিন।  

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
| People (কর্মচারী) | ✓ | ✓ | ✗ |
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
| Employee add/edit | ✓ | People |
| Device User ID map | ✓ | People |
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
