const statusElement = document.getElementById('registration-status');
const currentTime = Date.now();
const registrationOpens = Date.parse('2026-11-24T00:00:00+05:30');
const registrationCloses = Date.parse('2026-12-21T00:00:00+05:30');
if (currentTime < registrationOpens) {
  statusElement.textContent = 'Registration opens 24 November · Last date: 20 December 2026';
} else if (currentTime < registrationCloses) {
  statusElement.textContent = 'Registration window is open · Last date: 20 December 2026';
} else {
  statusElement.textContent = 'The announced registration deadline was 20 December 2026. Contact the organisers about late entries.';
}
