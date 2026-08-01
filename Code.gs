/**
 * LAND PARTY — MEMBERSHIP PORTAL BACKEND
 * ---------------------------------------
 * Deploy this bound to a Google Sheet:
 *   Extensions > Apps Script > paste this file as Code.gs
 *   Deploy > New deployment > Web app
 *     Execute as: Me
 *     Who has access: Anyone
 *   Copy the /exec URL into register.html and admin.html (API_URL constant)
 *
 * Before first use, set the admin password:
 *   Project Settings > Script Properties > add ADMIN_PASSWORD = <your password>
 *
 * See SETUP.md for full step-by-step instructions.
 */

const SHEET_MEMBERS = 'Members';
const SHEET_LOG = 'EmailLog';
const MEMBER_HEADERS = ['MembershipNumber','FirstName','LastName','Email','Phone','Province','Municipality','ReferredBy','JoinDate','Status'];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = {};
  try {
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }

    var action = params.action;
    var result;

    switch (action) {
      case 'register':
        result = registerMember(params);
        break;
      case 'login':
        checkAdmin(params);
        result = { ok: true };
        break;
      case 'stats':
        checkAdmin(params);
        result = getStats();
        break;
      case 'members':
        checkAdmin(params);
        result = getMembers(params);
        break;
      case 'ranking':
        checkAdmin(params);
        result = getRanking();
        break;
      case 'sendBulkEmail':
        checkAdmin(params);
        result = sendBulkEmail(params);
        break;
      case 'contactMessage':
        result = submitContactMessage(params);
        break;
      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return jsonOut(result);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Admin auth ----------

function checkAdmin(params) {
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw) throw new Error('Admin password is not configured. Set ADMIN_PASSWORD in Script Properties.');
  if (!params.password || params.password !== pw) throw new Error('Incorrect admin password.');
  return true;
}

// ---------- Sheet helpers ----------

function getMembersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MEMBERS);
    sheet.appendRow(MEMBER_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateMembershipNumber() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var props = PropertiesService.getScriptProperties();
    var year = new Date().getFullYear();
    var key = 'SEQ_' + year;
    var seq = parseInt(props.getProperty(key) || '0', 10) + 1;
    props.setProperty(key, String(seq));
    return 'LP' + year + '-' + ('00000' + seq).slice(-5);
  } finally {
    lock.releaseLock();
  }
}

// ---------- Registration ----------

function registerMember(p) {
  if (!p.firstName || !p.lastName || !p.email || !p.province) {
    throw new Error('First name, last name, email, and province are required.');
  }
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(p.email)) {
    throw new Error('Please enter a valid email address.');
  }

  var sheet = getMembersSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === p.email.toLowerCase()) {
      throw new Error('This email address is already registered.');
    }
  }

  // If a referral code was supplied, verify it exists
  var referredBy = (p.referredBy || '').trim().toUpperCase();
  if (referredBy) {
    var found = false;
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][0]).toUpperCase() === referredBy) { found = true; break; }
    }
    if (!found) referredBy = ''; // silently ignore invalid referral codes
  }

  var membershipNumber = generateMembershipNumber();
  var joinDate = new Date();

  sheet.appendRow([
    membershipNumber,
    p.firstName,
    p.lastName,
    p.email,
    p.phone || '',
    p.province,
    p.municipality || '',
    referredBy,
    joinDate,
    'Active'
  ]);

  sendWelcomeEmail(p, membershipNumber);

  return { ok: true, membershipNumber: membershipNumber };
}

function sendWelcomeEmail(p, membershipNumber) {
  var subject = 'Welcome to the Land Party — Membership Confirmed';
  var body =
    'Dear ' + p.firstName + ',\n\n' +
    'Thank you for joining the Land Party. Your membership has been confirmed.\n\n' +
    'Membership number: ' + membershipNumber + '\n' +
    'Province: ' + p.province + '\n' +
    (p.municipality ? ('Municipality: ' + p.municipality + '\n') : '') +
    '\nKeep your membership number safe — you\'ll need it to refer new members and at party events.\n\n' +
    'LAND. PEOPLE. SERVICES.\n\n' +
    '— The Land Party';
  MailApp.sendEmail(p.email, subject, body);
}

// ---------- Admin: stats ----------

function getStats() {
  var sheet = getMembersSheet();
  var data = sheet.getDataRange().getValues();
  var total = data.length - 1;
  var byProvince = {};
  var byMonth = {};

  for (var i = 1; i < data.length; i++) {
    var province = data[i][5] || 'Unknown';
    byProvince[province] = (byProvince[province] || 0) + 1;

    var d = data[i][8];
    if (d instanceof Date) {
      var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
  }

  return { ok: true, total: total, byProvince: byProvince, byMonth: byMonth };
}

function getMembers(p) {
  var sheet = getMembersSheet();
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (p.province && p.province !== 'All' && row[5] !== p.province) continue;
    if (p.search) {
      var s = p.search.toLowerCase();
      var haystack = (row[0] + ' ' + row[1] + ' ' + row[2] + ' ' + row[3]).toLowerCase();
      if (haystack.indexOf(s) === -1) continue;
    }
    rows.push({
      membershipNumber: row[0], firstName: row[1], lastName: row[2],
      email: row[3], phone: row[4], province: row[5], municipality: row[6],
      referredBy: row[7], joinDate: row[8], status: row[9]
    });
  }
  return { ok: true, headers: MEMBER_HEADERS, rows: rows };
}

// ---------- Admin: referral ranking ----------

function getRanking() {
  var sheet = getMembersSheet();
  var data = sheet.getDataRange().getValues();
  var names = {};
  var counts = {};

  for (var i = 1; i < data.length; i++) {
    names[data[i][0]] = data[i][1] + ' ' + data[i][2];
  }
  for (var j = 1; j < data.length; j++) {
    var ref = data[j][7];
    if (ref) counts[ref] = (counts[ref] || 0) + 1;
  }

  var ranking = [];
  for (var key in counts) {
    ranking.push({ membershipNumber: key, name: names[key] || 'Unknown', referrals: counts[key] });
  }
  ranking.sort(function (a, b) { return b.referrals - a.referrals; });

  return { ok: true, ranking: ranking };
}

// ---------- Admin: bulk email ----------

function sendBulkEmail(p) {
  if (!p.subject || !p.body) throw new Error('Subject and message body are required.');

  var sheet = getMembersSheet();
  var data = sheet.getDataRange().getValues();
  var recipients = [];

  for (var i = 1; i < data.length; i++) {
    var province = data[i][5];
    var municipality = data[i][6];
    var email = data[i][3];
    if (p.province && p.province !== 'All' && province !== p.province) continue;
    if (p.municipality && p.municipality !== 'All' && p.municipality !== '' && municipality !== p.municipality) continue;
    recipients.push(email);
  }

  var quota = MailApp.getRemainingDailyQuota();
  if (recipients.length === 0) {
    return { ok: false, error: 'No members match that filter.' };
  }
  if (recipients.length > quota) {
    return {
      ok: false,
      error: 'Not enough email quota left today. Remaining quota: ' + quota +
        ', recipients matched: ' + recipients.length +
        '. Gmail accounts get ~100/day, Google Workspace accounts get ~1500/day. Try sending in batches or tomorrow.'
    };
  }

  var sentCount = 0;
  for (var j = 0; j < recipients.length; j++) {
    MailApp.sendEmail(recipients[j], p.subject, p.body);
    sentCount++;
  }
  logEmail(p, sentCount);

  return { ok: true, sent: sentCount };
}

function logEmail(p, sentCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName(SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_LOG);
    log.appendRow(['Date', 'Subject', 'Province', 'Municipality', 'SentCount']);
    log.setFrozenRows(1);
  }
  log.appendRow([new Date(), p.subject, p.province || 'All', p.municipality || 'All', sentCount]);
}

// ---------- Contact form ----------

function submitContactMessage(p) {
  if (!p.name || !p.email || !p.message) {
    throw new Error('Name, email, and message are required.');
  }
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(p.email)) {
    throw new Error('Please enter a valid email address.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ContactMessages');
  if (!sheet) {
    sheet = ss.insertSheet('ContactMessages');
    sheet.appendRow(['Date', 'Name', 'Email', 'Message']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), p.name, p.email, p.message]);

  var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (adminEmail) {
    MailApp.sendEmail(adminEmail, 'New Land Party contact form message',
      'From: ' + p.name + ' (' + p.email + ')\n\n' + p.message);
  }

  return { ok: true };
}

// ---------- Weekly email trigger (optional) ----------

// Run setupWeeklyTrigger() once from the Apps Script editor to schedule a
// weekly reminder. It does NOT send member emails automatically — bulk
// emails always require an admin to compose and confirm them in the
// dashboard, since content/targeting changes every week. This just emails
// the admin a nudge.

function setupWeeklyTrigger() {
  ScriptApp.newTrigger('weeklyAdminReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
}

function weeklyAdminReminder() {
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!pw) return;
  var stats = getStats();
  MailApp.sendEmail(pw, 'Land Party — weekly membership reminder',
    'Total members: ' + stats.total + '\n\nOpen the admin dashboard to review stats and send this week\'s member update.');
}
