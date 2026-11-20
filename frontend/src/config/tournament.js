export const fallbackConfig = {
  name: "Urmila Gupta Memorial Cricket Tournament",
  season: 2,
  fee: 150,
  venue: "Tenughat Golden Jubilee Ground",
  opensAt: "2026-11-24T00:00:00+05:30",
  closesAt: "2026-12-21T00:00:00+05:30",
  registration: { isOpen: false, message: "24 November – 20 December 2026" },
  payment: {
    configured: true,
    payeeName: "Anubhav Jha",
    upiId: "8210708838sbi@axl",
    amount: 150,
    qrUrl: "/api/payment/qr",
  },
};
