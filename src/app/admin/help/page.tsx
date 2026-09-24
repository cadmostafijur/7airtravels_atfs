"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

const quickSteps = [
  { step: "১", where: "K50A মেশিন", action: "Fingerprint নিন + User ID দিন (যেমন 1001)" },
  { step: "২", where: "Admin (Employee records)", action: "নাম, ফোন, বিভাগ + K50A User ID = 1001 (admin add করে)" },
  { step: "৩", where: "K50A Devices", action: "Read users → 1001 আছে কিনা দেখুন" },
  { step: "৪", where: "Scan / Sync", action: "আঙুল দিন → Sync now → Dashboard-এ নাম আসে" },
];

const wrongVsRight = [
  { wrong: "কর্মচারী ওয়েবসাইট login করে", right: "শুধু Admin login করে — কর্মচারী K50A scan only" },
  { wrong: "Employee records-এ add করলেই K50A জানে", right: "K50A-তে আলাদা enroll করতে হবে" },
  { wrong: "ওয়েব থেকে fingerprint দেওয়া যায়", right: "Fingerprint শুধু K50A-তে" },
  { wrong: "নাম মিললেই চলবে", right: "K50A User ID নম্বর মিলতে হবে" },
];

const sections = [
  {
    title: "১. K50A ডিভাইস অফিস নেটওয়ার্কে সংযোগ",
    body: [
      "K50A Ethernet কেবল দিয়ে অফিস রাউটার/সুইচ-এ লাগান।",
      "K50A মেনু → TCP/IP: Static IP (যেমন 192.168.1.201), Port (4370), Gateway, Subnet Mask।",
      "একই LAN-এ PC থেকে: ping 192.168.1.201",
      "K50A TCP পোর্ট ইন্টারনেটে খুলবেন না — শুধু অফিস LAN বা VPN।",
    ],
  },
  {
    title: "২. ওয়েবসাইটে K50A যোগ করা",
    body: [
      "লগইন → K50A Devices → Add device",
      "Name: K50A-001, IP: ডিভাইসের IP, Port: 4370",
      "Adapter: k50a (আসল) / mock (টেস্ট)",
      "Save → Test connection → Get info / Read users / Sync now",
    ],
  },
  {
    title: "৩. Fingerprint — শুধু K50A-তে (ওয়েবে নয়)",
    body: [
      "K50A মেনু → User Management → New User",
      "User ID দিন (1001, 1002 …) — এটাই K50A User ID",
      "Enroll Fingerprint — ২–৩ বার আঙুল রাখুন",
      "ওয়েবসাইট থেকে fingerprint এনরোল করা যায় না (নিরাপত্তা)",
    ],
  },
  {
    title: "৪. Admin employee record যোগ করা (কর্মচারী login করে না)",
    body: [
      "Employee records → Add employee (শুধু admin)",
      "Code, Name, Phone, Department, Designation দিন",
      "K50A User ID = K50A-তে দেওয়া User ID (হুবহু একই)",
      "Create — scan করলে admin dashboard-এ ওই কর্মচারী দেখাবে",
      "কর্মচারীর কোনো website login/password নেই",
    ],
  },
  {
    title: "৫. উপস্থিতি কীভাবে আসে",
    body: [
      "কর্মচারী K50A-তে scan → মেশিনে লগ save",
      "Worker (পোর্ট 3001) বা Sync now → Neon DB",
      "deviceUserId (1001) দিয়ে Employee records-এ employee match",
      "Dashboard live feed + Attendance daily register update",
    ],
  },
  {
    title: "৬. দৈনিক রেজিস্টার (Attendance)",
    body: [
      "তারিখ ফিল্টার → Apply",
      "ADMIN: Edit / Delete / Add entry",
      "VIEWER: শুধু দেখতে পারে",
    ],
  },
  {
    title: "৭. অ্যাডমিন ও Role",
    body: [
      "লগইন: .env → ADMIN_BOOTSTRAP_EMAIL / PASSWORD",
      "পাসওয়ার্ড: My account → Change password",
      "SUPER_ADMIN / ADMIN: সব manage | VIEWER: শুধু দেখা",
    ],
  },
  {
    title: "৮. বেতন, লেট ও অনুপস্থিত পেনাল্টি",
    body: [
      "Employee records → Add/Edit employee → Monthly salary (যেমন 10000 টাকা)",
      "Salary page-এ company default: Late penalty / Absent penalty (প্রতিদিন)",
      "মাস শেষে Salary page খুলুন — late/absent দিন অনুযায়ী কাটা হয়ে Net payable দেখাবে",
      "উদাহরণ: বেতন 10000, late 200×2 দিন = 400, absent 500×1 = 500 → নেট 9100",
      "কোনো কর্মচারীর আলাদা পেনাল্টি লাগলে employee record-এ override দিন",
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        eyebrow="সহায়তা"
        title="বাংলা ব্যবহার নির্দেশিকা"
        description="K50A ও ওয়েবসাইট কীভাবে কাজ করে — সহজ বাংলায়"
      />

      <Card className="mb-6 border-navy/30 bg-navy/5">
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold text-navy">🔒 Admin-only website</h2>
          <p className="text-sm leading-relaxed">
            এই ওয়েবসাইট <strong>শুধু Admin</strong> use করবেন (HR, Manager)। সাধারণ কর্মচারী login করে না — তারা
            শুধু <strong>K50A-তে আঙুল scan</strong> করে। Admin Employee records-এ তাদের তথ্য রাখে।
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border-teal/40 bg-teal/5">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-teal">⭐ সবচেয়ে গুরুত্বপূর্ণ প্রশ্ন</h2>
            <p className="mt-2 text-sm leading-relaxed">
              <strong>Employee records-এ add করলে K50A কীভাবে জানে?</strong>
              <br />
              <strong>উত্তর: জানে না।</strong> ওয়েবসাইট K50A-তে কাউকে পাঠায় না। আপনি K50A-তে fingerprint
              enroll করবেন, তারপর ওয়েবসাইটে <strong>একই User ID নম্বর</strong> দিয়ে employee যোগ করবেন।
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickSteps.map((item) => (
              <div key={item.step} className="rounded-lg border border-line bg-paper p-3 text-sm">
                <div className="mb-1 font-semibold text-teal">ধাপ {item.step}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{item.where}</div>
                <div className="mt-1 leading-relaxed">{item.action}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="py-2 pr-4">❌ ভুল ধারণা</th>
                  <th className="py-2">✅ সত্যি</th>
                </tr>
              </thead>
              <tbody>
                {wrongVsRight.map((row) => (
                  <tr key={row.wrong} className="border-b border-line/60">
                    <td className="py-2 pr-4 text-muted">{row.wrong}</td>
                    <td className="py-2">{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
          বিস্তারিত markdown গাইড: <code className="rounded bg-paper px-1">docs/BANGLA-GUIDE.md</code>
        </CardContent>
      </Card>
    </div>
  );
}
