// App Store listing for TARAhut Haazri, pushed to App Store Connect with `eas metadata:push`.
// The review sign-in code is never stored here: run the command with REVIEW_CODE set in the shell, e.g.
//   REVIEW_CODE=1234 eas metadata:push
// App Privacy (the data-collection labels) is not covered by this file; fill it in App Store Connect.
const reviewCode = process.env.REVIEW_CODE;
if (!/^\d{4}$/.test(reviewCode || '')) {
  throw new Error('Set REVIEW_CODE to the 4-digit review sign-in code, e.g. REVIEW_CODE=1234 eas metadata:push');
}

const description = `TARAhut Haazri makes daily attendance simple and honest for teams in offices, shops and on site.

CHECK IN WITH A SELFIE
Tap Check In, take a quick selfie and the app records the time and where you are. Check out the same way and your hours are worked out for you. If your company uses location lock, you can only check in at the workplace.

SEE YOUR MONTH
A calendar shows every day: present, late, half day, leave, holiday or absent, with your in and out times.

LEAVE AND CORRECTIONS
Ask for leave or an attendance correction from the app and get notified when your admin decides.

REMINDERS
A reminder if you haven't checked in by your start time, and one to check out at the end of your shift.

FOR ADMINS
See who is in, late or absent today with selfies, approve leave and corrections, and manage staff. The web dashboard adds monthly sheets, salary from attendance, advances, month close and Excel downloads.

PRIVATE BY DESIGN
Location is read only when you check in or out, never in the background. Selfies are shown only to your company's admins. No ads, no tracking. You can delete your account from the app at any time.

Haazri works for any business. Set up your company free at haazri.tarahutaibuilds.com/start, then add your staff. Staff sign in with their phone number and a code sent to their email.`;

const reviewNotes = `Sign-in is by phone number and a one-time code. Enter 9000000001, tap Continue, enter the code given in the sign-in details and tap Verify (no email is sent for this demo account). It belongs to a demo company with no location lock, so check-in works anywhere: tap Check In, allow camera and location, take a selfie.

Admin demo: 9000000002 with the same code. It shows Team today, leave and correction approvals, and Staff.

Account deletion: You > Delete my account. Any business can create its own company free at https://haazri.tarahutaibuilds.com/start; its admin then adds the staff.`;

module.exports = {
  configVersion: 0,
  apple: {
    copyright: '2026 Parveen Sukhija',
    categories: ['BUSINESS'],
    info: {
      'en-US': {
        title: 'TARAhut Haazri',
        subtitle: 'Selfie attendance for teams',
        description,
        keywords: ['attendance', 'staff', 'selfie', 'check in', 'leave', 'payroll', 'salary', 'employee', 'HR', 'team', 'shift', 'haazri'],
        promoText: 'Selfie and location check-in, leave, corrections and reminders for your whole team.',
        supportUrl: 'https://haazri.tarahutaibuilds.com/support',
        marketingUrl: 'https://tarahutaibuilds.com',
        privacyPolicyUrl: 'https://haazri.tarahutaibuilds.com/privacy',
      },
    },
    review: {
      firstName: 'Parveen',
      lastName: 'Sukhija',
      email: 'support@tarahutaibuilds.com',
      phone: '+91 9915424411',
      demoRequired: true,
      demoUsername: '9000000001',
      demoPassword: reviewCode,
      notes: reviewNotes,
    },
  },
};
