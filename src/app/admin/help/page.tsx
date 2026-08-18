"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    title: "১. K50A ডিভাইস অফিস নেটওয়ার্কে সংযোগ",
    body: [
      "K50A টার্মিনাল Ethernet কেবল দিয়ে অফিস রাউটার/সুইচ-এ লাগান।",
      "K50A মেনু থেকে TCP/IP সেট করুন: Static IP (যেমন 192.168.1.201), Port (সাধারণত 4370), Gateway ও Subnet Mask।",
      "একই LAN-এ কোনো PC থেকে ping করুন: ping 192.168.1.201",
      "K50A TCP পোর্ট ইন্টারনেটে খুলবেন না — শুধু অফিস LAN বা VPN।",
    ],
  },
  {
    title: "২. ওয়েবসাইটে K50A যোগ করা",
    body: [
      "লগইন → K50A Devices → Add device",
      "Name: K50A-001, IP: ডিভাইসের IP, Port: 4370 (ডিভাইসে যা সেট আছে)",
      "Adapter: k50a (আসল ডিভাইস) বা mock (টেস্ট)",
      "Save device → ডিভাইস খুলে Test connection চাপুন",
      "সফল হলে: Get info, Read users, Read transactions, Sync now",
    ],
  },
  {
    title: "৩. কর্মচারীর আঙুল (Fingerprint) এনরোল — K50A-তে",
    body: [
      "⚠️ অ্যাডমিন ওয়েবসাইট থেকে আঙুলের ছাপ এনরোল করতে পারে না।",
      "আঙুলের টেমপ্লেট K50A ডিভাইসেই থাকে — এটাই নিরাপদ পদ্ধতি।",
      "K50A মেনু → User Management → New User",
      "User ID দিন (যেমন 1001) — এটাই Device User ID",
      "Fingerprint enroll করুন (২–৩ বার আঙুল রাখুন)",
      "ডিভাইসে নাম দিতে পারেন; ওয়েবসাইটে সম্পূর্ণ নাম/বিভাগ/ফোন অ্যাডমিন রাখে।",
    ],
  },
  {
    title: "৪. ওয়েবসাইটে কর্মচারী যোগ করা",
    body: [
      "People → Add employee",
      "Employee Code: EMP001, Name, Phone, Department, Designation",
      "Device User ID: K50A-তে যে User ID দিয়েছেন (যেমন 1001) — অবশ্যই মিলতে হবে",
      "Save — এখন আঙুল দিলে সিস্টেম ওই কর্মচারী চিনবে",
      "Edit/Deactivate: কর্মচারী তালিকা থেকে নামে ক্লিক",
    ],
  },
  {
    title: "৫. উপস্থিতি কীভাবে ওয়েবসাইটে আসে",
    body: [
      "কর্মচারী K50A-তে আঙুল দেয় → ডিভাইসে লগ সেভ",
      "Worker (পোর্ট 3001) বা Sync now → লগ Neon DB-তে যায়",
      "Duplicate হলে আবার insert হয় না",
      "Dashboard live feed + Attendance daily register আপডেট",
      "৩ জন অ্যাডমিন SMS (SMS পেজে নম্বর + Enable)",
    ],
  },
  {
    title: "৬. দৈনিক রেজিস্টার (Daily Register)",
    body: [
      "Attendance মেনু → তারিখ ফিল্টার → Apply",
      "ADMIN/SUPER_ADMIN: Edit — স্ট্যাটাস, check-in/out, নোট সংশোধন",
      "ADMIN/SUPER_ADMIN: Delete — দৈনিক সারাংশ মুছে (raw fingerprint log থাকে)",
      "Add entry — ম্যানুয়াল এন্ট্রি (ছুটি/সংশোধন)",
      "VIEWER: শুধু দেখতে পারে, Edit/Delete নয়",
    ],
  },
  {
    title: "৭. অ্যাডমিন একাউন্ট ও পাসওয়ার্ড",
    body: [
      "লগইন: .env-এ ADMIN_BOOTSTRAP_EMAIL / PASSWORD",
      "পাসওয়ার্ড বদল: My account → Change password",
      "নতুন অ্যাডমিন DB seed: npm run db:seed:admin",
    ],
  },
  {
    title: "৮. ভূমিকা (Role) ও অ্যাক্সেস",
    body: [
      "SUPER_ADMIN: সব + Audit + ডিভাইস dangerous action",
      "ADMIN: কর্মচারী, উপস্থিতি edit/delete, K50A, SMS, Shift",
      "VIEWER: Dashboard, Attendance দেখা, Reports — edit নয়",
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        eyebrow="সহায়তা"
        title="বাংলা ব্যবহার নির্দেশিকা"
        description="7 Air Travels ATFS — K50A সংযোগ, কর্মচারী ও দৈনিক রেজিস্টার"
      />
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-5">
              <h2 className="mb-3 font-semibold text-teal">{section.title}</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
                {section.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardContent className="p-5 text-sm text-muted">
          Full markdown guide in the project folder:{" "}
          <code className="rounded bg-paper px-1">docs/BANGLA-GUIDE.md</code>
        </CardContent>
      </Card>
    </div>
  );
}
