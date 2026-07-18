const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  mobile: { type: String },
  address: { type: String },
  ekyc_verified: { type: Boolean, default: false },
  password: { type: String },
  push_token: { type: String },
  manager_email: { type: String },
  face_descriptor: { type: String }, // Store as JSON string or stringified array
  created_at: { type: Date, default: Date.now }
});

const CaseSchema = new mongoose.Schema({
  case_number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, default: 'Pending' },
  icon: { type: String, default: 'home' },
  icon_color: { type: String, default: '#F59E0B' },
  assigned_to_email: { type: String },
  patient_name: { type: String },
  hospital_name: { type: String },
  hospital_address: { type: String },
  state_id: { type: Number },
  city_id: { type: Number },
  is_rework: { type: Number },
  insurance_id: { type: Number },
  type_id: { type: Number },
  sub_type_id: { type: Number },
  allocation_date: { type: Date },
  patient_mobile: { type: String },
  patient_address: { type: String },
  patient_state_id: { type: Number },
  patient_city_id: { type: Number },
  patient_pin_code: { type: String },
  diagnosis: { type: String },
  trigger_reason: { type: String },
  pin_code: { type: String },
  am_id: { type: Number },
  alm_id: { type: Number },
  is_single_fo: { type: Number },
  master_fo: { type: Number },
  map_questions: { type: Number },
  initial_documents: { type: String },
  created_at: { type: Date, default: Date.now }
});

const UserAttendanceV2Schema = new mongoose.Schema({
  user_email: { type: String },
  user_id: { type: String }, // Can be email or an ObjectId string representation
  attendance_date: { type: String }, // stored as YYYY-MM-DD
  punch_in_time: { type: Date },
  punch_out_time: { type: Date },
  status: { type: String },
  face_descriptor: { type: String },
  device_imei: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  deleted_at: { type: Date, default: null }
});

const TaskStatSchema = new mongoose.Schema({
  user_email: { type: String, required: true, unique: true },
  total_tasks: { type: Number, default: 0 },
  completed_tasks: { type: Number, default: 0 }
});

const MrdChargeSchema = new mongoose.Schema({
  claim_no: { type: String, required: true },
  customer_name: { type: String, required: true },
  hospital_name: { type: String, required: true },
  state: { type: String },
  district: { type: String },
  file_path: { type: String },
  file_path_2: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  created_at: { type: Date, default: Date.now }
});

const CaseStatusHistorySchema = new mongoose.Schema({
  case_number: { type: String, required: true },
  user_email: { type: String, required: true },
  status: { type: String, required: true },
  updated_at: { type: Date, default: Date.now }
});

const LeaveBalanceSchema = new mongoose.Schema({
  user_email: { type: String, required: true, unique: true },
  annual_leave: { type: Number, default: 12 },
  total_annual_leave: { type: Number, default: 20 },
  sick_leave: { type: Number, default: 4 },
  total_sick_leave: { type: Number, default: 10 }
});

const LeaveApplicationSchema = new mongoose.Schema({
  user_email: { type: String },
  leave_type: { type: String },
  start_date: { type: String },
  end_date: { type: String },
  status: { type: String, default: 'Pending' },
  created_at: { type: Date, default: Date.now }
});

const PayslipSchema = new mongoose.Schema({
  payslip_id: { type: String, required: true },
  user_email: { type: String },
  month: { type: String },
  amount: { type: String },
  created_at: { type: Date, default: Date.now }
});

const VaultHistorySchema = new mongoose.Schema({
  user_email: { type: String },
  case_number: { type: String },
  type: { type: String }, // audio or video
  title: { type: String },
  duration: { type: String },
  created_at: { type: Date, default: Date.now }
});

const SosAlertSchema = new mongoose.Schema({
  user_email: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  status: { type: String, default: 'Active' },
  created_at: { type: Date, default: Date.now }
});

const CompanySettingSchema = new mongoose.Schema({
  setting_key: { type: String, required: true, unique: true },
  setting_value: { type: String, required: true },
  description: { type: String }
});

const CaseMediaSchema = new mongoose.Schema({
  case_number: { type: String },
  section_id: { type: String },
  media_type: { type: String, required: true },
  camera_type: { type: String, default: 'none' },
  file_path: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Case: mongoose.model('Case', CaseSchema),
  UserAttendanceV2: mongoose.model('UserAttendanceV2', UserAttendanceV2Schema),
  TaskStat: mongoose.model('TaskStat', TaskStatSchema),
  MrdCharge: mongoose.model('MrdCharge', MrdChargeSchema),
  CaseStatusHistory: mongoose.model('CaseStatusHistory', CaseStatusHistorySchema),
  LeaveBalance: mongoose.model('LeaveBalance', LeaveBalanceSchema),
  LeaveApplication: mongoose.model('LeaveApplication', LeaveApplicationSchema),
  Payslip: mongoose.model('Payslip', PayslipSchema),
  VaultHistory: mongoose.model('VaultHistory', VaultHistorySchema),
  SosAlert: mongoose.model('SosAlert', SosAlertSchema),
  CompanySetting: mongoose.model('CompanySetting', CompanySettingSchema),
  CaseMedia: mongoose.model('CaseMedia', CaseMediaSchema),
};
