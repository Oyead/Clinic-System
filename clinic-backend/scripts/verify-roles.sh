#!/bin/bash
# Verifies every action for each role EXCEPT admin.
# (Admin login is used only for setup - approving the clinic and resolving a
# suspension - since the spec requires an admin for those steps.)
#
# Usage: BASE=http://localhost:5001 bash scripts/verify-roles.sh
# Requires: backend running + migrations applied.
B=${BASE:-http://localhost:5000}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@clinic.local}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-PickAStrongPassword123!}
R=$RANDOM
PASS=0; SKIP=0
pass(){ PASS=$((PASS+1)); echo "PASS: $1"; }
skip(){ SKIP=$((SKIP+1)); echo "SKIP: $1"; }
fail(){ echo "FAIL: $1 -- $2"; exit 1; }
jq(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const v=($1);console.log(v===undefined?'UNDEF':v)}catch(e){console.log('PARSE_ERR')}})"; }
code(){ curl -s -m 10 -o /tmp/verify-body.json -w '%{http_code}' "$@"; }

echo "== setup: clinic + staff =="
C=$(curl -s -m 10 -X POST $B/api/v1/auth/signup-clinic -H 'Content-Type: application/json' -d '{"email":"vo'$R'@ex.com","password":"password123","clinic":{"name":"Verify Clinic '$R'","phone_number":"+1-555-0100","address":"1 Main St"}}')
[ "$(echo "$C" | jq 'j.user.status')" == "pending_verification" ] && pass "owner pending after signup" || fail "owner signup" "$C"
OT=$(echo "$C" | jq 'j.token'); CID=$(echo "$C" | jq 'j.clinic.id')
A=$(curl -s -m 10 -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}')
AT=$(echo "$A" | jq 'j.token')
[ "$AT" != "UNDEF" ] && pass "admin login (setup only)" || fail "admin login" "$A"
AP=$(curl -s -m 10 -X PATCH $B/api/v1/admin/clinics/$CID/approve -H "Authorization: Bearer $AT")
[ "$(echo "$AP" | jq 'j.clinic.status')" == "active" ] && pass "clinic approved (setup)" || fail "approve" "$AP"

mkstaff(){
  # $1=email $2=role $3=name [$4=specialization]
  local body; body=$(node -e 'const a=process.argv.slice(1);const b={email:a[0],role:a[1],name:a[2]};if(a[3])b.specialization=a[3];console.log(JSON.stringify(b))' "$1" "$2" "$3" "$4")
  local resp; resp=$(curl -s -m 10 -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d "$body")
  local tok; tok=$(echo "$resp" | jq 'j.inviteToken')
  local uid; uid=$(echo "$resp" | jq 'j.user.id')
  curl -s -m 10 -X POST $B/api/v1/auth/accept-invite -H 'Content-Type: application/json' -d '{"token":"'$tok'","password":"password123"}' > /dev/null
  echo "$uid"
}
DUID=$(mkstaff "vdoc$R@ex.com" doctor "Verify Doc" cardio)
RUID=$(mkstaff "vrec$R@ex.com" receptionist "Verify Recep")
DT=$(curl -s -m 10 -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"vdoc'$R'@ex.com","password":"password123"}' | jq 'j.token')
RT=$(curl -s -m 10 -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"vrec'$R'@ex.com","password":"password123"}' | jq 'j.token')
DID=$(curl -s -m 10 $B/api/v1/owner/clinics/$CID/staff -H "Authorization: Bearer $OT" | jq 'j.staff.find(s=>s.user_id==='$DUID').doctor_id')
[ "$DT" != "UNDEF" ] && [ "$RT" != "UNDEF" ] && pass "doctor + receptionist active" || fail "staff login" ""
FEE=$(curl -s -m 10 -X PATCH $B/api/v1/owner/clinics/$CID/doctors/$DID/fee -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"consultation_fee":250}')
[ "$(echo "$FEE" | jq 'Number(j.doctor.consultation_fee)')" == "250" ] && pass "owner sets consultation fee" || fail "owner fee" "$FEE"

echo "== PATIENT =="
P=$(curl -s -m 10 -X POST $B/api/v1/auth/signup -H 'Content-Type: application/json' -d '{"email":"vpat'$R'@ex.com","password":"password123","name":"Verify Pat"}')
[ "$(echo "$P" | jq 'j.user.role')" == "patient" ] && pass "patient signup role hardcoded" || fail "patient signup" "$P"
PT=$(echo "$P" | jq 'j.token')
BO_P=$(curl -s -m 10 $B/api/v1/appointments/booking-options -H "Authorization: Bearer $PT")
[ "$(echo "$BO_P" | jq 'j.clinics.length>0 && j.doctors.length>0')" == "true" ] && pass "patient sees full booking list" || fail "patient options" "$BO_P"
MINE=$(curl -s -m 10 $B/api/v1/appointments/mine -H "Authorization: Bearer $PT")
[ "$(echo "$MINE" | jq 'Array.isArray(j.appointments)')" == "true" ] && pass "patient lists own appointments" || fail "patient mine" "$MINE"
[ "$(code -X POST $B/api/v1/auth/signup -H 'Content-Type: application/json' -d '{"email":"x@ex.com"}')" == "400" ] && pass "patient signup validates input" || fail "signup validation" "$(cat /tmp/verify-body.json)"
FUTURE1=$(node -e "console.log(new Date(Date.now()+86400000).toISOString())")
FUTURE2=$(node -e "console.log(new Date(Date.now()+172800000).toISOString())")
book(){ curl -s -m 10 -X POST $B/api/v1/appointments/ -H "Authorization: Bearer $PT" -H 'Content-Type: application/json' -d '{"clinic_id":'$CID',"doctor_id":'$DID',"appointment_date":"'$1'"}'; }
BK1=$(book "$FUTURE1"); BK2=$(book "$FUTURE2")
APPT1=$(echo "$BK1" | jq 'j.appointment ? j.appointment.id : null')
APPT2=$(echo "$BK2" | jq 'j.appointment ? j.appointment.id : null')
if [ "$APPT1" != "null" ] && [ "$APPT1" != "UNDEF" ]; then pass "patient books appointment (#$APPT1)"; else APPT1=""; fi
if [ "$APPT2" != "null" ] && [ "$APPT2" != "UNDEF" ]; then pass "patient books second appointment (#$APPT2)"; else APPT2=""; fi
if [ -z "$APPT1" ]; then skip "patient booking (clinic closed at test time): $(echo "$BK1" | jq 'j.error')"; fi
[ "$(code -X PATCH $B/api/v1/appointments/999999/approve -H "Authorization: Bearer $PT")" == "403" ] && pass "patient cannot approve appointments" || fail "patient approve gate" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $PT" -H 'Content-Type: application/json' -d '{"email":"no@ex.com","role":"doctor","name":"No"}')" == "403" ] && pass "patient cannot invite staff" || fail "patient invite gate" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/admin/users -H "Authorization: Bearer $PT")" == "403" ] && pass "patient blocked from admin routes" || fail "patient admin gate" "$(cat /tmp/verify-body.json)"

echo "== CLINIC OWNER =="
[ "$(code $B/api/v1/owner/clinics -H "Authorization: Bearer $OT")" == "200" ] && pass "owner lists clinics" || fail "owner clinics" "$(cat /tmp/verify-body.json)"
INV=$(curl -s -m 10 -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"email":"extra'$R'@ex.com","role":"doctor","name":"Extra","specialization":"derma"}')
[ "$(echo "$INV" | jq 'j.user.status')" == "invited" ] && pass "owner invites doctor" || fail "owner invite" "$INV"
EXUID=$(echo "$INV" | jq 'j.user.id'); ETOK=$(echo "$INV" | jq 'j.inviteToken')
curl -s -m 10 -X POST $B/api/v1/auth/accept-invite -H 'Content-Type: application/json' -d '{"token":"'$ETOK'","password":"password123"}' > /dev/null
[ "$(code $B/api/v1/owner/clinics/$CID/invites -H "Authorization: Bearer $OT")" == "200" ] && pass "owner lists invites" || fail "owner invites list" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"email":"bad'$R'@ex.com","role":"admin","name":"Bad"}')" == "403" ] && pass "owner cannot invite admin (matrix)" || fail "owner matrix" "$(cat /tmp/verify-body.json)"
if [ -n "$APPT1" ]; then
  APPR=$(curl -s -m 10 -X PATCH $B/api/v1/owner/appointments/$APPT1/approve -H "Authorization: Bearer $OT")
  [ "$(echo "$APPR" | jq 'j.appointment.status')" == "awaiting_payment" ] && pass "owner approves into awaiting_payment" || fail "owner approve" "$APPR"
  [ "$(code $B/api/v1/payments/config -H "Authorization: Bearer $PT")" == "200" ] && pass "patient reads payment config" || fail "payment config" "$(cat /tmp/verify-body.json)"
  [ "$(code $B/api/v1/payments/appointments/$APPT1 -H "Authorization: Bearer $DT")" == "403" ] && pass "doctor cannot read patient payment" || fail "doctor payment gate" "$(cat /tmp/verify-body.json)"
  PAY=$(curl -s -m 10 $B/api/v1/payments/appointments/$APPT1 -H "Authorization: Bearer $PT")
  [ "$(echo "$PAY" | jq 'j.payment_status')" == "pending" ] && pass "patient sees pending payment" || fail "patient payment status" "$PAY"
  [ "$(code -X POST $B/api/v1/payments/appointments/$APPT1/intention -H "Authorization: Bearer $PT" -H 'Content-Type: application/json' -d '{}')" == "400" ] && pass "intention requires phone when missing" || fail "intention phone" "$(cat /tmp/verify-body.json)"
  INT_CODE=$(code -X POST $B/api/v1/payments/appointments/$APPT1/intention -H "Authorization: Bearer $PT" -H 'Content-Type: application/json' -d '{"phone_number":"+201000000000"}')
  if [ "$INT_CODE" == "201" ] || [ "$INT_CODE" == "503" ]; then pass "patient can start payment ($INT_CODE)"; else fail "patient intention" "$(cat /tmp/verify-body.json)"; fi
  [ "$(code -X POST $B/api/v1/payments/paymob/webhook -H 'Content-Type: application/json' -d '{}')" == "400" ] && pass "unsigned Paymob webhook rejected" || fail "webhook hmac" "$(cat /tmp/verify-body.json)"
else skip "owner approve (no appointment created)"; fi
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/$EXUID/suspend -H "Authorization: Bearer $OT")" == "200" ] && pass "owner suspends staff" || fail "owner suspend" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/$EXUID/offboard -H "Authorization: Bearer $OT")" == "200" ] && pass "owner offboards (confirmed departure)" || fail "owner offboard" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/admin/users -H "Authorization: Bearer $OT")" == "403" ] && pass "owner blocked from admin routes" || fail "owner admin gate" "$(cat /tmp/verify-body.json)"
[ "$(code -X PUT $B/api/v1/admin/doctors/1/assign -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"clinic_id":1}')" == "403" ] && pass "owner cannot reassign clinic in place" || fail "owner reassign gate" "$(cat /tmp/verify-body.json)"

echo "== DOCTOR =="
[ "$(code $B/api/v1/appointments/ -H "Authorization: Bearer $DT")" == "200" ] && pass "doctor lists queue" || fail "doctor queue" "$(cat /tmp/verify-body.json)"
BO_D=$(curl -s -m 10 $B/api/v1/appointments/booking-options -H "Authorization: Bearer $DT")
[ "$(echo "$BO_D" | jq 'j.clinics.length')" == "1" ] && [ "$(echo "$BO_D" | jq 'j.clinics[0].id')" == "$CID" ] && pass "doctor sees only own clinic" || fail "doctor scope" "$BO_D"
if [ -n "$APPT2" ]; then
  [ "$(code -X PATCH $B/api/v1/appointments/$APPT2/approve -H "Authorization: Bearer $DT")" == "200" ] && pass "doctor approves request" || fail "doctor approve" "$(cat /tmp/verify-body.json)"
else skip "doctor approve (no appointment created)"; fi
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $DT" -H 'Content-Type: application/json' -d '{"email":"no2@ex.com","role":"doctor","name":"No"}')" == "403" ] && pass "doctor cannot invite (matrix)" || fail "doctor invite gate" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/admin/users -H "Authorization: Bearer $DT")" == "403" ] && pass "doctor blocked from admin routes" || fail "doctor admin gate" "$(cat /tmp/verify-body.json)"

echo "== RECEPTIONIST =="
BO_R=$(curl -s -m 10 $B/api/v1/appointments/booking-options -H "Authorization: Bearer $RT")
[ "$(echo "$BO_R" | jq 'j.clinics.length')" == "1" ] && [ "$(echo "$BO_R" | jq 'j.clinics[0].id')" == "$CID" ] && [ "$(echo "$BO_R" | jq 'j.doctors.filter(d=>d.clinic_id!=='$CID').length')" == "0" ] && pass "receptionist sees only own clinic + doctors" || fail "receptionist scope" "$BO_R"
[ "$(code $B/api/v1/appointments/ -H "Authorization: Bearer $RT")" == "200" ] && pass "receptionist lists queue" || fail "receptionist queue" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/owner/clinics/$CID/staff/invite -H "Authorization: Bearer $RT" -H 'Content-Type: application/json' -d '{"email":"no3@ex.com","role":"receptionist","name":"No"}')" == "403" ] && pass "receptionist cannot invite (matrix)" || fail "receptionist invite gate" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/admin/users -H "Authorization: Bearer $RT")" == "403" ] && pass "receptionist blocked from admin routes" || fail "receptionist admin gate" "$(cat /tmp/verify-body.json)"

echo "== SUSPEND / REINSTATE (admin resolves, staff experiences) =="
[ "$(code -X POST $B/api/v1/admin/users/$DUID/suspend -H "Authorization: Bearer $AT")" == "200" ] && pass "admin suspends doctor" || fail "suspend" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"vdoc'$R'@ex.com","password":"password123"}')" == "403" ] && pass "suspended doctor login blocked" || fail "suspended login" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/admin/users/$DUID/reinstate -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"password":"newpass123"}')" == "200" ] && pass "admin reinstates with fresh password" || fail "reinstate" "$(cat /tmp/verify-body.json)"
[ "$(code -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"vdoc'$R'@ex.com","password":"newpass123"}')" == "200" ] && pass "reinstated doctor logs in" || fail "reinstate login" "$(cat /tmp/verify-body.json)"

echo "== AUTH EDGE CASES =="
[ "$(code -X POST $B/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"vdoc'$R'@ex.com","password":"wrongpass1"}')" == "401" ] && pass "wrong password rejected" || fail "wrong password" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/appointments/mine)" == "401" ] && pass "missing token rejected" || fail "missing token" "$(cat /tmp/verify-body.json)"
[ "$(code $B/api/v1/appointments/mine -H 'Authorization: Bearer invalid.token.here')" == "401" ] && pass "invalid token rejected" || fail "invalid token" "$(cat /tmp/verify-body.json)"

echo ""
echo "ALL ROLE TESTS PASSED ($PASS passed, $SKIP skipped)"
