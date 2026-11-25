export interface ModuleFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'product_select' | 'employee_select' | 'slot_select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  defaultValue?: string | number;
}

export interface ModuleTemplatePreset {
  label: string;
  title: string;
  subtitle: string;
  status?: string;
  amount?: number;
  meta: Record<string, string | number>;
}

export type EmbeddedModuleBoard =
  | 'restaurant_floor'
  | 'attendance_board'
  | 'employee_performance';

export interface ModuleBlueprint {
  moduleId: string;
  summaryMetricLabel: string;
  statuses: string[];
  titleLabel: string;
  titlePlaceholder: string;
  subtitlePlaceholder: string;
  amountLabel: string;
  autoCompute?:
    | 'rental_total'
    | 'qty_unit_cost'
    | 'hours_rate'
    | 'parts_plus_labor'
    | 'monthly_x_months';
  embeddedBoard?: EmbeddedModuleBoard;
  fields: ModuleFieldDef[];
  templates: ModuleTemplatePreset[];
  quickAdvanceLabel?: string;
  quickAdvanceToStatus?: string;
}

export const MODULE_BLUEPRINTS: Record<string, ModuleBlueprint> = {
  rental: {
    moduleId: 'rental',
    summaryMetricLabel: 'Active Lease Value',
    statuses: ['Reserved', 'Checked Out', 'Overdue', 'Returned & Inspected'],
    titleLabel: 'Asset / Contract Reference',
    titlePlaceholder: 'e.g. RNT-2026-104 · Makita 2000W Jackhammer',
    subtitlePlaceholder: 'Customer name, ID/Passport #, deposit & site location',
    amountLabel: 'Total Lease Fee',
    autoCompute: 'rental_total',
    quickAdvanceLabel: 'Mark Returned',
    quickAdvanceToStatus: 'Returned & Inspected',
    fields: [
      { key: 'lesseeName', label: 'Customer / Lessee', type: 'text', placeholder: 'e.g. Kamau Contractors Ltd' },
      { key: 'lesseePhone', label: 'Phone (+254)', type: 'text', placeholder: '0722 410 882' },
      { key: 'rentalDays', label: 'Lease Days', type: 'number', placeholder: '5', defaultValue: 3 },
      { key: 'dailyRate', label: 'Daily Rate', type: 'number', placeholder: '2500', defaultValue: 2500 },
      { key: 'depositAmount', label: 'Security Deposit', type: 'number', placeholder: '5000', defaultValue: 5000 },
      { key: 'returnDueDate', label: 'Return Due Date', type: 'date' },
    ],
    templates: [
      {
        label: 'Power Tool 3-Day Lease',
        title: 'RNT-108 · Heavy Rotary Hammer & Bit Kit',
        subtitle: 'Site: Kilimani Annex · ID Verified · Deposit Held',
        status: 'Checked Out',
        amount: 7500,
        meta: {
          lesseeName: 'Kamau Builders Ltd',
          lesseePhone: '254722410882',
          rentalDays: 3,
          dailyRate: 2500,
          depositAmount: 5000,
        },
      },
      {
        label: 'Event Tent & Chairs Hire',
        title: 'RNT-109 · 100-Seater Gazebo Tent + 80 Chairs',
        subtitle: 'Weekend Wedding Hire · Karen Grounds · Delivery Included',
        status: 'Reserved',
        amount: 24000,
        meta: {
          lesseeName: 'Grace Wambui Events',
          lesseePhone: '254711904210',
          rentalDays: 2,
          dailyRate: 12000,
          depositAmount: 10000,
        },
      },
    ],
  },

  restaurant: {
    moduleId: 'restaurant',
    summaryMetricLabel: 'Open Table & KOT Value',
    statuses: ['Order Placed', 'Cooking in Kitchen', 'Ready to Serve', 'Served', 'Table Cleared'],
    titleLabel: 'Kitchen Ticket / Order Ref',
    titlePlaceholder: 'e.g. KOT-204 · Nyama Choma Platter & 3 Lattes',
    subtitlePlaceholder: 'Special dietary notes, allergies, or course sequence',
    amountLabel: 'Order Bill Total',
    embeddedBoard: 'restaurant_floor',
    quickAdvanceLabel: 'Mark Served',
    quickAdvanceToStatus: 'Served',
    fields: [
      { key: 'tableSlot', label: 'Dining Table / Zone', type: 'slot_select' },
      { key: 'waiterName', label: 'Assigned Waiter / Server', type: 'employee_select' },
      { key: 'guestCount', label: 'Covers (Guests)', type: 'number', placeholder: '4', defaultValue: 2 },
      {
        key: 'serviceType',
        label: 'Service Channel',
        type: 'select',
        options: ['Dine-In', 'Kitchen Pickup', 'Bar Tab', 'VIP Terrace'],
      },
      {
        key: 'coursePrep',
        label: 'Prep Station',
        type: 'select',
        options: ['Main Grill & Hot Kitchen', 'Barista & Cold Bar', 'Pastry & Bakery', 'All Stations'],
      },
    ],
    templates: [
      {
        label: 'Bistro Table Order',
        title: 'KOT-302 · 2x Nyama Feast + 4x Kenyan AA Espresso',
        subtitle: 'Medium-well grill · Extra Kachumbari · Split bill requested',
        status: 'Cooking in Kitchen',
        amount: 4650,
        meta: { guestCount: 4, serviceType: 'Dine-In', coursePrep: 'All Stations' },
      },
      {
        label: 'Bar Tab',
        title: 'KOT-303 · Rooftop Sundowner Drinks & Platter',
        subtitle: 'Open tab · Pay on departure via M-Pesa',
        status: 'Order Placed',
        amount: 3200,
        meta: { guestCount: 3, serviceType: 'Bar Tab', coursePrep: 'Barista & Cold Bar' },
      },
    ],
  },

  purchase: {
    moduleId: 'purchase',
    summaryMetricLabel: 'Procurement Spend',
    statuses: ['RFQ Sent', 'PO Confirmed', 'In Transit', 'Received (GRN)'],
    titleLabel: 'Purchase Order / Supplier Ref',
    titlePlaceholder: 'e.g. PO-2026-441 · Bamburi Cement 200 Bags',
    subtitlePlaceholder: 'Supplier KRA PIN, delivery note #, payment terms',
    amountLabel: 'Total PO Cost',
    autoCompute: 'qty_unit_cost',
    fields: [
      { key: 'supplier', label: 'Supplier Name', type: 'text', placeholder: 'e.g. Kenya Coffee Roasters Ltd' },
      { key: 'productId', label: 'Restock SKU (Auto-adds to Stock on GRN)', type: 'product_select' },
      { key: 'qty', label: 'Order Qty', type: 'number', placeholder: '50', defaultValue: 20 },
      { key: 'unitCost', label: 'Unit Cost', type: 'number', placeholder: '850', defaultValue: 500 },
      { key: 'expectedDate', label: 'Expected Delivery', type: 'date' },
    ],
    templates: [
      {
        label: 'Stock Replenishment PO',
        title: 'PO-2026-812 · Scheduled Supplier Restock',
        subtitle: 'Net-15 Trade Terms · Direct to Receiving Bay',
        status: 'PO Confirmed',
        amount: 25000,
        meta: { supplier: 'Highland Distributors KE', qty: 50, unitCost: 500 },
      },
    ],
  },

  manufacturing: {
    moduleId: 'manufacturing',
    summaryMetricLabel: 'Production Output Value',
    statuses: ['Planned', 'In Production', 'QC Passed', 'Completed'],
    titleLabel: 'Manufacturing Order (MO)',
    titlePlaceholder: 'e.g. MO-409 · 200x Roasted AA Coffee 500g Packs',
    subtitlePlaceholder: 'Bill of Materials (BoM), raw material batch & shift supervisor',
    amountLabel: 'Batch Valuation',
    autoCompute: 'qty_unit_cost',
    quickAdvanceLabel: 'Complete Batch',
    quickAdvanceToStatus: 'Completed',
    fields: [
      { key: 'productId', label: 'Finished Product SKU', type: 'product_select' },
      { key: 'qty', label: 'Batch Output Qty', type: 'number', placeholder: '100', defaultValue: 50 },
      { key: 'unitCost', label: 'Unit Production Cost', type: 'number', placeholder: '420', defaultValue: 400 },
      { key: 'supervisor', label: 'Production Lead', type: 'employee_select' },
      { key: 'workCenter', label: 'Work Center / Line', type: 'text', placeholder: 'Line A · Packaging & Sealing' },
    ],
    templates: [
      {
        label: 'Packaging & Assembly Batch',
        title: 'MO-2026-14 · Finished Goods Assembly Run',
        subtitle: 'BoM Verified · Packaging seals & expiry lot stamped',
        status: 'In Production',
        amount: 20000,
        meta: { qty: 50, unitCost: 400, workCenter: 'Assembly Line A' },
      },
    ],
  },

  repair: {
    moduleId: 'repair',
    summaryMetricLabel: 'Repair Revenue',
    statuses: ['Received / Diagnosing', 'Awaiting Parts', 'Repairing', 'Ready for Pickup', 'Delivered'],
    titleLabel: 'Repair / RMA Ticket',
    titlePlaceholder: 'e.g. RMA-441 · Inverter Welding Machine Board Swap',
    subtitlePlaceholder: 'Serial number, fault diagnosis & warranty status',
    amountLabel: 'Total Repair Charge',
    autoCompute: 'parts_plus_labor',
    quickAdvanceLabel: 'Mark Ready',
    quickAdvanceToStatus: 'Ready for Pickup',
    fields: [
      { key: 'deviceOrAsset', label: 'Item / Serial #', type: 'text', placeholder: 'SN-882910-KE' },
      { key: 'customerName', label: 'Customer Name & Phone', type: 'text', placeholder: 'John Njoroge · 0712...' },
      { key: 'technician', label: 'Assigned Technician', type: 'employee_select' },
      { key: 'partsCost', label: 'Spare Parts Cost', type: 'number', placeholder: '3200', defaultValue: 2000 },
      { key: 'laborFee', label: 'Labor Fee', type: 'number', placeholder: '1500', defaultValue: 1500 },
      {
        key: 'warrantyStatus',
        label: 'Warranty',
        type: 'select',
        options: ['Out of Warranty (Billable)', 'Under Manufacturer Warranty', 'Store 30-Day Guarantee'],
      },
    ],
    templates: [
      {
        label: 'Hardware / Appliance Repair',
        title: 'RMA-502 · Commercial Grinder Motor Overhaul',
        subtitle: 'Bearing replacement & armature rewind · 48h turnaround',
        status: 'Repairing',
        amount: 3500,
        meta: {
          deviceOrAsset: 'GRND-PRO-441',
          customerName: 'Java Bistro · 0722991002',
          partsCost: 2000,
          laborFee: 1500,
          warrantyStatus: 'Out of Warranty (Billable)',
        },
      },
    ],
  },

  maintenance: {
    moduleId: 'maintenance',
    summaryMetricLabel: 'Maintenance Budget',
    statuses: ['Scheduled', 'In Progress', 'Awaiting Vendor', 'Completed'],
    titleLabel: 'Equipment / Asset Work Order',
    titlePlaceholder: 'e.g. MNT-102 · Cold Room Compressor Quarterly Service',
    subtitlePlaceholder: 'Preventive checklist, safety lockout & parts used',
    amountLabel: 'Service Cost',
    quickAdvanceLabel: 'Complete Service',
    quickAdvanceToStatus: 'Completed',
    fields: [
      { key: 'assetTag', label: 'Asset Tag / Machine', type: 'text', placeholder: 'CR-CHILLER-02' },
      {
        key: 'maintenanceType',
        label: 'Maintenance Type',
        type: 'select',
        options: ['Preventive Schedule', 'Corrective Breakdown', 'Calibration / KEBS Cert', 'Safety Inspection'],
      },
      { key: 'assignedTech', label: 'Technician / Vendor', type: 'text', placeholder: 'FridgeTech Services KE' },
      { key: 'nextDueDate', label: 'Next Service Due', type: 'date' },
    ],
    templates: [
      {
        label: 'Preventive Chiller / POS Check',
        title: 'MNT-209 · Monthly Cold-Chain & Generator Service',
        subtitle: 'Oil filter swap, coolant pressure check & ATS transfer test',
        status: 'Scheduled',
        amount: 8500,
        meta: { assetTag: 'GEN-60KVA-01', maintenanceType: 'Preventive Schedule', assignedTech: 'PowerGen Engineers' },
      },
    ],
  },

  quality: {
    moduleId: 'quality',
    summaryMetricLabel: 'Inspected Batch Value',
    statuses: ['Pending Review', 'Passed QC', 'Quarantined', 'Completed'],
    titleLabel: 'QC Inspection Lot',
    titlePlaceholder: 'e.g. QC-BATCH-89 · KEBS Moisture & Seal Integrity',
    subtitlePlaceholder: 'Sample size inspected, tolerance range & lab observations',
    amountLabel: 'Lot Value',
    quickAdvanceLabel: 'Pass QC',
    quickAdvanceToStatus: 'Passed QC',
    fields: [
      { key: 'productId', label: 'Product Inspected', type: 'product_select' },
      { key: 'inspector', label: 'QC Inspector', type: 'employee_select' },
      { key: 'sampleSize', label: 'Sample Qty Checked', type: 'number', placeholder: '25', defaultValue: 20 },
      { key: 'defectCount', label: 'Defects Found', type: 'number', placeholder: '0', defaultValue: 0 },
      {
        key: 'standardCode',
        label: 'Compliance Standard',
        type: 'select',
        options: ['KEBS KS-ISO Standard', 'HACCP Food Safety', 'ISO 9001 Batch Check', 'Internal Receiving QC'],
      },
    ],
    templates: [
      {
        label: 'KEBS Incoming Batch QC',
        title: 'QC-2026-44 · Incoming Stock Hygiene & Weight Check',
        subtitle: 'Random 20-unit sample within ±1% net weight tolerance',
        status: 'Pending Review',
        amount: 45000,
        meta: { sampleSize: 20, defectCount: 0, standardCode: 'KEBS KS-ISO Standard' },
      },
    ],
  },

  fleet: {
    moduleId: 'fleet',
    summaryMetricLabel: 'Fleet Trip & Fuel Spend',
    statuses: ['Scheduled', 'En Route', 'Fuel / Service Logged', 'Completed'],
    titleLabel: 'Vehicle Reg / Trip Log',
    titlePlaceholder: 'e.g. KDK 418M · Thika Road Wholesale Delivery Run',
    subtitlePlaceholder: 'Cargo manifest, route stops & fuel receipt number',
    amountLabel: 'Trip / Fuel Cost',
    quickAdvanceLabel: 'Complete Trip',
    quickAdvanceToStatus: 'Completed',
    fields: [
      { key: 'plateNo', label: 'Number Plate', type: 'text', placeholder: 'KDK 418M' },
      { key: 'driverName', label: 'Driver / Rider', type: 'employee_select' },
      { key: 'odometerKm', label: 'Odometer (km)', type: 'number', placeholder: '84210' },
      { key: 'fuelLitres', label: 'Fuel (Litres)', type: 'number', placeholder: '45' },
      { key: 'routeDestination', label: 'Route / Delivery Zone', type: 'text', placeholder: 'Nairobi CBD -> Westlands -> Karen' },
    ],
    templates: [
      {
        label: 'Van Delivery Dispatch',
        title: 'KDM 902P · Morning Branch Replenishment Trip',
        subtitle: 'Loaded 18 crates · EPRA fuel voucher attached',
        status: 'En Route',
        amount: 6400,
        meta: { plateNo: 'KDM 902P', odometerKm: 51200, fuelLitres: 35, routeDestination: 'CBD -> Westlands' },
      },
    ],
  },

  expenses: {
    moduleId: 'expenses',
    summaryMetricLabel: 'Total Expense Claims',
    statuses: ['Submitted', 'Pending Review', 'Approved', 'Reimbursed'],
    titleLabel: 'Expense Description',
    titlePlaceholder: 'e.g. EXP-112 · Delivery Rider Fuel & M-Pesa Floats',
    subtitlePlaceholder: 'Vendor name, KRA eTIMS receipt CUIN & justification',
    amountLabel: 'Claim Amount',
    quickAdvanceLabel: 'Reimburse',
    quickAdvanceToStatus: 'Reimbursed',
    fields: [
      {
        key: 'expenseCategory',
        label: 'Cost Center',
        type: 'select',
        options: ['Fuel & Logistics', 'Utilities & Power', 'Store Supplies', 'Staff Welfare & Travel', 'Repairs & Maintenance'],
      },
      { key: 'claimant', label: 'Staff Claimant', type: 'employee_select' },
      { key: 'receiptRef', label: 'Receipt / M-Pesa Ref', type: 'text', placeholder: 'SJK82901KE' },
      { key: 'expenseDate', label: 'Incurred Date', type: 'date' },
    ],
    templates: [
      {
        label: 'Fuel & Rider Claim',
        title: 'EXP-2026-19 · Dispatch Fuel & Airtime Top-up',
        subtitle: 'Total Energies Shell receipt attached · Approved by Branch Mgr',
        status: 'Submitted',
        amount: 3800,
        meta: { expenseCategory: 'Fuel & Logistics', receiptRef: 'SHL-99201' },
      },
    ],
  },

  attendances: {
    moduleId: 'attendances',
    summaryMetricLabel: 'Shift Hours Tracked',
    statuses: ['Active Shift', 'Completed', 'Late Arrival', 'Verified for Payroll'],
    titleLabel: 'Shift / Roster Note',
    titlePlaceholder: 'e.g. Morning Register Shift — Counter 1 & Floor',
    subtitlePlaceholder: 'Overtime notes, handover balance & branch location',
    amountLabel: 'Overtime Bonus',
    embeddedBoard: 'attendance_board',
    quickAdvanceLabel: 'Verify Shift',
    quickAdvanceToStatus: 'Verified for Payroll',
    fields: [
      { key: 'staffMember', label: 'Staff Member', type: 'employee_select' },
      { key: 'shiftWindow', label: 'Shift Window', type: 'select', options: ['Morning (07:00 - 15:30)', 'Evening (14:00 - 22:30)', 'Full Day (08:00 - 18:00)', 'Night Watch'] },
      { key: 'hoursWorked', label: 'Hours Worked', type: 'number', placeholder: '8.5', defaultValue: 8 },
    ],
    templates: [
      {
        label: 'Weekend Overtime Log',
        title: 'OT-2026-04 · Stocktake & Shelf Restock Shift',
        subtitle: 'Evening inventory audit completion bonus',
        status: 'Completed',
        amount: 1200,
        meta: { shiftWindow: 'Evening (14:00 - 22:30)', hoursWorked: 4 },
      },
    ],
  },

  time_off: {
    moduleId: 'time_off',
    summaryMetricLabel: 'Leave Compensation Value',
    statuses: ['Requested', 'Manager Review', 'Approved', 'Declined'],
    titleLabel: 'Leave Request Summary',
    titlePlaceholder: 'e.g. Annual Leave — 5 Days (December)',
    subtitlePlaceholder: 'Handover relief colleague & emergency contact',
    amountLabel: 'Leave Allowance',
    quickAdvanceLabel: 'Approve Leave',
    quickAdvanceToStatus: 'Approved',
    fields: [
      { key: 'employeeName', label: 'Employee', type: 'employee_select' },
      {
        key: 'leaveType',
        label: 'Leave Category',
        type: 'select',
        options: ['Annual Leave (21 Days/Yr)', 'Sick Leave', 'Compassionate Leave', 'Maternity / Paternity', 'Unpaid Leave'],
      },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'daysCount', label: 'Days Requested', type: 'number', placeholder: '5', defaultValue: 3 },
    ],
    templates: [
      {
        label: 'Annual Leave Request',
        title: 'LV-2026-11 · Scheduled Annual Leave (3 Days)',
        subtitle: 'Shift covered by relief cashier · Branch manager notified',
        status: 'Requested',
        amount: 0,
        meta: { leaveType: 'Annual Leave (21 Days/Yr)', daysCount: 3 },
      },
    ],
  },

  recruitment: {
    moduleId: 'recruitment',
    summaryMetricLabel: 'Offered Package Budget',
    statuses: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Offer Sent', 'Hired'],
    titleLabel: 'Candidate Name & Role',
    titlePlaceholder: 'e.g. Brian Ochieng — Senior Cashier & POS Lead',
    subtitlePlaceholder: 'Experience summary, KRA PIN readiness & interview scorecard',
    amountLabel: 'Proposed Monthly Gross',
    quickAdvanceLabel: 'Move to Offer',
    quickAdvanceToStatus: 'Offer Sent',
    fields: [
      { key: 'candidatePhone', label: 'Phone / Email', type: 'text', placeholder: '0722 330 119 · brian@mail.ke' },
      {
        key: 'targetRole',
        label: 'Target Position',
        type: 'select',
        options: ['Cashier', 'Store Manager', 'Inventory Clerk', 'Accountant', 'Field Agent', 'Chef / Barista'],
      },
      { key: 'interviewDate', label: 'Interview Date', type: 'date' },
      { key: 'yearsExp', label: 'Years Experience', type: 'number', placeholder: '3', defaultValue: 2 },
    ],
    templates: [
      {
        label: 'Retail Cashier Candidate',
        title: 'REC-104 · Faith Chebet — POS & Customer Service',
        subtitle: '3 yrs supermarket POS experience · Ready for immediate start',
        status: 'Shortlisted',
        amount: 28000,
        meta: { candidatePhone: '254712334455', targetRole: 'Cashier', yearsExp: 3 },
      },
    ],
  },

  appraisals: {
    moduleId: 'appraisals',
    summaryMetricLabel: 'Performance Bonus Pool',
    statuses: ['Self-Review', 'Manager Review', 'Calibrated', 'Completed'],
    titleLabel: 'Appraisal Cycle & Staff',
    titlePlaceholder: 'e.g. Q4 Review · Service Speed, Accuracy & Customer Stars',
    subtitlePlaceholder: 'Strengths, coaching goals & tip-share recognition',
    amountLabel: 'Performance Bonus',
    embeddedBoard: 'employee_performance',
    quickAdvanceLabel: 'Finalize Review',
    quickAdvanceToStatus: 'Completed',
    fields: [
      { key: 'employeeName', label: 'Employee Evaluated', type: 'employee_select' },
      {
        key: 'scoreBand',
        label: 'Rating Tier',
        type: 'select',
        options: ['5/5 · Exceptional Leader', '4/5 · Exceeds Expectations', '3/5 · Meets Target', '2/5 · Coaching Plan'],
      },
      { key: 'kpiScorePct', label: 'KPI Attainment (%)', type: 'number', placeholder: '94', defaultValue: 92 },
    ],
    templates: [
      {
        label: 'Quarterly Service Bonus',
        title: 'APR-Q4 · Top Cashier Zero-Variance & Rating Award',
        subtitle: '98% receipt accuracy + 4.9★ average customer score',
        status: 'Manager Review',
        amount: 5000,
        meta: { scoreBand: '5/5 · Exceptional Leader', kpiScorePct: 98 },
      },
    ],
  },

  planning: {
    moduleId: 'planning',
    summaryMetricLabel: 'Scheduled Shift Budget',
    statuses: ['Draft Roster', 'Published to Staff', 'Active Week', 'Completed'],
    titleLabel: 'Roster / Shift Plan',
    titlePlaceholder: 'e.g. Week 48 · Holiday Peak Register Staffing',
    subtitlePlaceholder: 'Branches covered, break rotations & peak-hour coverage',
    amountLabel: 'Estimated Shift Cost',
    autoCompute: 'hours_rate',
    quickAdvanceLabel: 'Publish Roster',
    quickAdvanceToStatus: 'Published to Staff',
    fields: [
      { key: 'assignee', label: 'Lead Staff', type: 'employee_select' },
      { key: 'hours', label: 'Total Shift Hours', type: 'number', placeholder: '40', defaultValue: 40 },
      { key: 'hourlyRate', label: 'Hourly Rate', type: 'number', placeholder: '350', defaultValue: 350 },
      { key: 'weekStart', label: 'Week Commencing', type: 'date' },
    ],
    templates: [
      {
        label: 'Weekly Counter Roster',
        title: 'PLN-W48 · Main Register & Floor Coverage',
        subtitle: 'Full 7-day staggered rotation · 2 opening, 2 closing staff',
        status: 'Published to Staff',
        amount: 14000,
        meta: { hours: 40, hourlyRate: 350 },
      },
    ],
  },

  project: {
    moduleId: 'project',
    summaryMetricLabel: 'Project Contract Value',
    statuses: ['Backlog', 'In Progress', 'Client Review', 'Completed'],
    titleLabel: 'Project / Milestone Name',
    titlePlaceholder: 'e.g. PRJ-09 · Westlands Branch Fit-Out & Shelving',
    subtitlePlaceholder: 'Deliverables, contractor dependencies & sign-off checklist',
    amountLabel: 'Project Budget',
    quickAdvanceLabel: 'Complete Milestone',
    quickAdvanceToStatus: 'Completed',
    fields: [
      { key: 'projectLead', label: 'Project Manager', type: 'employee_select' },
      { key: 'dueDate', label: 'Target Deadline', type: 'date' },
      { key: 'progressPct', label: 'Completion (%)', type: 'number', placeholder: '65', defaultValue: 50 },
      { key: 'clientOrDept', label: 'Client / Department', type: 'text', placeholder: 'Internal Expansion / B2B Client' },
    ],
    templates: [
      {
        label: 'Branch Rollout Project',
        title: 'PRJ-2026-07 · New Counter & Cold Display Installation',
        subtitle: 'Electrical, POS cabling, barcode printer & KRA VSCU commissioning',
        status: 'In Progress',
        amount: 85000,
        meta: { progressPct: 60, clientOrDept: 'Operations' },
      },
    ],
  },

  timesheets: {
    moduleId: 'timesheets',
    summaryMetricLabel: 'Billable Timesheet Total',
    statuses: ['Logged', 'Submitted', 'Approved', 'Invoiced'],
    titleLabel: 'Task / Engagement Logged',
    titlePlaceholder: 'e.g. TS-402 · On-Site Hardware & Networking Setup',
    subtitlePlaceholder: 'Work summary, deliverables & client approval reference',
    amountLabel: 'Billable Total',
    autoCompute: 'hours_rate',
    quickAdvanceLabel: 'Approve Hours',
    quickAdvanceToStatus: 'Approved',
    fields: [
      { key: 'consultant', label: 'Staff / Technician', type: 'employee_select' },
      { key: 'hours', label: 'Billable Hours', type: 'number', placeholder: '6', defaultValue: 4 },
      { key: 'hourlyRate', label: 'Hourly Billing Rate', type: 'number', placeholder: '2000', defaultValue: 1500 },
      { key: 'workDate', label: 'Date Worked', type: 'date' },
    ],
    templates: [
      {
        label: 'Client Service Timesheet',
        title: 'TS-2026-88 · Field Technician Installation Hours',
        subtitle: 'Client signed job card · Ready for invoicing',
        status: 'Submitted',
        amount: 6000,
        meta: { hours: 4, hourlyRate: 1500 },
      },
    ],
  },

  helpdesk: {
    moduleId: 'helpdesk',
    summaryMetricLabel: 'SLA Compensation / Credit',
    statuses: ['Open', 'In Progress', 'Awaiting Customer', 'Resolved', 'Closed'],
    titleLabel: 'Support Ticket Subject',
    titlePlaceholder: 'e.g. TKT-340 · Receipt Printer Paper Jam & Warranty Check',
    subtitlePlaceholder: 'Issue description, reproduction steps & resolution summary',
    amountLabel: 'Service Credit / Fee',
    quickAdvanceLabel: 'Resolve Ticket',
    quickAdvanceToStatus: 'Resolved',
    fields: [
      { key: 'requester', label: 'Customer / Branch', type: 'text', placeholder: 'e.g. Kilimani Customer / Branch 02' },
      { key: 'assignee', label: 'Assigned Agent', type: 'employee_select' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Urgent (2h SLA)', 'High (4h SLA)', 'Normal (24h SLA)', 'Low'] },
      { key: 'channel', label: 'Channel', type: 'select', options: ['POS Desk', 'WhatsApp / SMS', 'Email Support', 'Phone'] },
    ],
    templates: [
      {
        label: 'Customer Return / Warranty',
        title: 'TKT-341 · Exchange & Credit Note Assistance',
        subtitle: 'Customer receipt verified · Replacement unit dispatched',
        status: 'In Progress',
        amount: 0,
        meta: { requester: 'Walk-in Customer', priority: 'High (4h SLA)', channel: 'POS Desk' },
      },
    ],
  },

  appointments: {
    moduleId: 'appointments',
    summaryMetricLabel: 'Booking Fees',
    statuses: ['Requested', 'Confirmed', 'Checked In', 'Completed', 'No Show'],
    titleLabel: 'Booking / Client Service',
    titlePlaceholder: 'e.g. APT-109 · Bridal Styling & Hair Treatment (2h)',
    subtitlePlaceholder: 'Client phone, service preferences & deposit M-Pesa ref',
    amountLabel: 'Service Fee',
    quickAdvanceLabel: 'Confirm Booking',
    quickAdvanceToStatus: 'Confirmed',
    fields: [
      { key: 'clientName', label: 'Client Name & Phone', type: 'text', placeholder: 'Mercy Wanjiru · 0714...' },
      { key: 'specialist', label: 'Assigned Specialist', type: 'employee_select' },
      { key: 'appointmentDate', label: 'Booking Date', type: 'date' },
      { key: 'timeSlot', label: 'Time Slot', type: 'text', placeholder: '10:30 AM - 12:00 PM' },
    ],
    templates: [
      {
        label: 'Client Consultation / Salon Slot',
        title: 'APT-204 · 60-Min Express Consultation & Fitting',
        subtitle: 'SMS reminder scheduled via Africa’s Talking 2h before',
        status: 'Confirmed',
        amount: 2500,
        meta: { clientName: 'Mercy Wanjiru · 0714889012', timeSlot: '11:00 AM' },
      },
    ],
  },

  approvals: {
    moduleId: 'approvals',
    summaryMetricLabel: 'Approved Spend Value',
    statuses: ['Pending Review', 'Approved', 'Rejected', 'Completed'],
    titleLabel: 'Approval Request Title',
    titlePlaceholder: 'e.g. APR-315 · Branch Generator Overhaul Spend',
    subtitlePlaceholder: 'Policy rule, business justification & approver note',
    amountLabel: 'Requested Budget',
    quickAdvanceLabel: 'Approve Request',
    quickAdvanceToStatus: 'Approved',
    fields: [
      { key: 'requester', label: 'Requested By', type: 'employee_select' },
      {
        key: 'approvalCategory',
        label: 'Approval Type',
        type: 'select',
        options: ['Capital Purchase', 'Discount Override', 'Refund / Credit Note', 'Supplier Payment', 'HR Hiring'],
      },
      { key: 'urgency', label: 'Urgency', type: 'select', options: ['Immediate', 'This Week', 'Monthly Cycle'] },
    ],
    templates: [
      {
        label: 'Capex / Supplier Sign-Off',
        title: 'APR-318 · High-Value Stock Purchase Authorization',
        subtitle: 'Exceeds KES 50,000 manager limit — requires Owner sign-off',
        status: 'Pending Review',
        amount: 75000,
        meta: { approvalCategory: 'Capital Purchase', urgency: 'Immediate' },
      },
    ],
  },

  sign: {
    moduleId: 'sign',
    summaryMetricLabel: 'Executed Contract Value',
    statuses: ['Drafting', 'Sent for Signature', 'Signed & Sealed', 'Archived'],
    titleLabel: 'Contract / Agreement Title',
    titlePlaceholder: 'e.g. SIG-2026-08 · Commercial Lease Renewal & SLA',
    subtitlePlaceholder: 'Counterparty legal name, witnessing advocates & renewal clause',
    amountLabel: 'Contract Value',
    quickAdvanceLabel: 'Mark Signed',
    quickAdvanceToStatus: 'Signed & Sealed',
    fields: [
      { key: 'counterparty', label: 'Signatory / Counterparty', type: 'text', placeholder: 'e.g. Nairobi Mall Properties Ltd' },
      { key: 'docType', label: 'Document Type', type: 'select', options: ['Commercial Lease', 'Supplier SLA', 'Employment Contract', 'NDA / Confidentiality'] },
      { key: 'expiryDate', label: 'Valid Until', type: 'date' },
    ],
    templates: [
      {
        label: 'Supplier SLA Agreement',
        title: 'SIG-2026-14 · Annual Wholesale Supply & Credit Terms',
        subtitle: '30-day credit limit + eTIMS electronic tax invoicing clause',
        status: 'Sent for Signature',
        amount: 500000,
        meta: { counterparty: 'Highland Distributors Ltd', docType: 'Supplier SLA' },
      },
    ],
  },

  equity: {
    moduleId: 'equity',
    summaryMetricLabel: 'Authorized Capital Value',
    statuses: ['Board Proposed', 'Issued', 'Vested', 'Registered (BRS)'],
    titleLabel: 'Shareholder / Cap Table Entry',
    titlePlaceholder: 'e.g. EQ-01 · Seed Ordinary Shares Allocation',
    subtitlePlaceholder: 'Share certificate #, vesting cliff & BRS filing reference',
    amountLabel: 'Valuation / Capital',
    quickAdvanceLabel: 'Register Shareholding',
    quickAdvanceToStatus: 'Registered (BRS)',
    fields: [
      { key: 'holderName', label: 'Shareholder / Director', type: 'text', placeholder: 'e.g. Amina Hassan' },
      { key: 'shareClass', label: 'Share Class', type: 'select', options: ['Ordinary Voting Shares', 'Preference Shares', 'ESOP Staff Options', 'Convertible Note'] },
      { key: 'sharesCount', label: 'Shares Allocated', type: 'number', placeholder: '10000', defaultValue: 1000 },
      { key: 'ownershipPct', label: 'Stake (%)', type: 'number', placeholder: '25', defaultValue: 10 },
    ],
    templates: [
      {
        label: 'Director Share Certificate',
        title: 'EQ-2026-03 · Founder Ordinary Equity Tranche',
        subtitle: 'Filed with Kenya eCitizen Business Registration Service',
        status: 'Registered (BRS)',
        amount: 2500000,
        meta: { holderName: 'Founder Holding', shareClass: 'Ordinary Voting Shares', sharesCount: 25000, ownershipPct: 25 },
      },
    ],
  },

  esg: {
    moduleId: 'esg',
    summaryMetricLabel: 'Sustainability Spend',
    statuses: ['Baseline Logged', 'In Progress', 'Verified Audit', 'Published'],
    titleLabel: 'ESG / Carbon Metric Entry',
    titlePlaceholder: 'e.g. ESG-2026-Q4 · Solar Offset & Biodegradable Packaging',
    subtitlePlaceholder: 'Measurement methodology, NEMA compliance & impact notes',
    amountLabel: 'Green Investment',
    quickAdvanceLabel: 'Verify Audit',
    quickAdvanceToStatus: 'Verified Audit',
    fields: [
      {
        key: 'pillar',
        label: 'ESG Pillar',
        type: 'select',
        options: ['Environmental (Carbon & Solar)', 'Social (Staff Welfare & Gender)', 'Governance (Tax & Ethics)'],
      },
      { key: 'co2ReducedKg', label: 'CO₂ Offset (kg)', type: 'number', placeholder: '450', defaultValue: 200 },
      { key: 'reportingPeriod', label: 'Reporting Quarter', type: 'text', placeholder: 'Q4 2026' },
    ],
    templates: [
      {
        label: 'Solar & Waste Audit',
        title: 'ESG-Q4 · Branch Solar Inverter & Plastic-Free Bags',
        subtitle: 'Eliminated 100% single-use polythene · NEMA compliant',
        status: 'Verified Audit',
        amount: 42000,
        meta: { pillar: 'Environmental (Carbon & Solar)', co2ReducedKg: 620, reportingPeriod: 'Q4 2026' },
      },
    ],
  },

  subscriptions: {
    moduleId: 'subscriptions',
    summaryMetricLabel: 'Recurring Revenue (MRR)',
    statuses: ['Trial', 'Active', 'Renewal Due', 'Paused', 'Cancelled'],
    titleLabel: 'Subscriber / Contract Name',
    titlePlaceholder: 'e.g. SUB-402 · Sarova Monthly Coffee & Tea Retainer',
    subtitlePlaceholder: 'Auto-invoice schedule, M-Pesa standing order & delivery cadence',
    amountLabel: 'Total Contract Value',
    autoCompute: 'monthly_x_months',
    quickAdvanceLabel: 'Activate Plan',
    quickAdvanceToStatus: 'Active',
    fields: [
      { key: 'subscriberName', label: 'Client / Account', type: 'text', placeholder: 'Java Hospitality Ltd' },
      { key: 'billingCycle', label: 'Cycle', type: 'select', options: ['Monthly', 'Quarterly', 'Annual'] },
      { key: 'monthlyFee', label: 'Fee Per Cycle', type: 'number', placeholder: '18500', defaultValue: 10000 },
      { key: 'monthsCount', label: 'Cycles / Months', type: 'number', placeholder: '6', defaultValue: 3 },
      { key: 'nextRenewalDate', label: 'Next Renewal Date', type: 'date' },
    ],
    templates: [
      {
        label: 'Monthly B2B Supply Plan',
        title: 'SUB-2026-19 · Monthly Office Pantry Refill Retainer',
        subtitle: 'Auto-dispatched every 1st of month with KRA eTIMS invoice',
        status: 'Active',
        amount: 30000,
        meta: { subscriberName: 'Westlands Co-Work Hub', billingCycle: 'Monthly', monthlyFee: 10000, monthsCount: 3 },
      },
    ],
  },

  documents: {
    moduleId: 'documents',
    summaryMetricLabel: 'Archived Asset Value',
    statuses: ['Draft', 'Active Filing', 'Verified Legal', 'Archived'],
    titleLabel: 'Document Name / Ref',
    titlePlaceholder: 'e.g. DOC-KRA-TCC · 2026 KRA Tax Compliance Certificate',
    subtitlePlaceholder: 'Issuing authority, storage folder & retention period',
    amountLabel: 'Statutory Fee',
    quickAdvanceLabel: 'Verify Filing',
    quickAdvanceToStatus: 'Verified Legal',
    fields: [
      {
        key: 'folder',
        label: 'Vault Folder',
        type: 'select',
        options: ['KRA & Tax Filings', 'County Business Permits', 'Supplier Contracts', 'HR & Payroll Archives', 'Insurance Policies'],
      },
      { key: 'referenceNo', label: 'Certificate / Ref #', type: 'text', placeholder: 'KRA-TCC-998120' },
      { key: 'expiryDate', label: 'Renewal / Expiry Date', type: 'date' },
    ],
    templates: [
      {
        label: 'County Permit & KRA TCC',
        title: 'DOC-2026-01 · Unified Business Permit & Fire Clearance',
        subtitle: 'Displayed at branch entrance · Digitally backed up',
        status: 'Verified Legal',
        amount: 15000,
        meta: { folder: 'County Business Permits', referenceNo: 'NCC-UBP-2026-8812' },
      },
    ],
  },

  knowledge: {
    moduleId: 'knowledge',
    summaryMetricLabel: 'SOP Modules Covered',
    statuses: ['Draft SOP', 'Under Review', 'Published Playbook', 'Archived'],
    titleLabel: 'SOP / Playbook Title',
    titlePlaceholder: 'e.g. SOP-POS-01 · End-of-Day Cash Drawer & M-Pesa Z-Report',
    subtitlePlaceholder: 'Step-by-step operator instructions & escalation contacts',
    amountLabel: 'Est. Read Mins',
    quickAdvanceLabel: 'Publish SOP',
    quickAdvanceToStatus: 'Published Playbook',
    fields: [
      { key: 'department', label: 'Department', type: 'select', options: ['POS & Cashiers', 'Warehouse & Stock', 'Kitchen & Hospitality', 'eTIMS & Finance', 'Customer Care'] },
      { key: 'author', label: 'SOP Owner', type: 'employee_select' },
      { key: 'version', label: 'Version', type: 'text', placeholder: 'v2.1' },
    ],
    templates: [
      {
        label: 'Cashier Shift Closing SOP',
        title: 'SOP-04 · Blind Cash Count, M-Pesa Reconciliation & Z-Report',
        subtitle: 'Mandatory checklist before cashier clocks out on POS',
        status: 'Published Playbook',
        amount: 5,
        meta: { department: 'POS & Cashiers', version: 'v2.0' },
      },
    ],
  },

  blog: {
    moduleId: 'blog',
    summaryMetricLabel: 'Monthly Organic Views',
    statuses: ['Outline', 'SEO Draft', 'Published Live', 'Archived'],
    titleLabel: 'Article / Guide Title',
    titlePlaceholder: 'e.g. Why Kenyan Single-Origin AA Coffee Tastes Better Freshly Roasted',
    subtitlePlaceholder: 'SEO target keyword, meta summary & storefront product links',
    amountLabel: 'Target Traffic',
    quickAdvanceLabel: 'Publish Post',
    quickAdvanceToStatus: 'Published Live',
    fields: [
      { key: 'seoSlug', label: 'URL Slug', type: 'text', placeholder: '/blog/kenyan-aa-coffee-guide' },
      { key: 'category', label: 'Topic', type: 'select', options: ['Product Guides', 'Customer Stories', 'How-To Tutorials', 'Company News'] },
      { key: 'author', label: 'Author', type: 'employee_select' },
    ],
    templates: [
      {
        label: 'SEO Product Launch Post',
        title: 'How to Choose the Right Equipment & Supplies for Your Site',
        subtitle: 'Linked directly to storefront checkout for organic conversion',
        status: 'Published Live',
        amount: 1200,
        meta: { seoSlug: '/blog/equipment-buying-guide', category: 'Product Guides' },
      },
    ],
  },

  forum: {
    moduleId: 'forum',
    summaryMetricLabel: 'Community Votes / Replies',
    statuses: ['Open Question', 'Staff Answered', 'Accepted Solution', 'Pinned'],
    titleLabel: 'Discussion / FAQ Topic',
    titlePlaceholder: 'e.g. Do you offer same-day Nairobi delivery & KRA eTIMS PIN invoices?',
    subtitlePlaceholder: 'Customer question & verified official store reply',
    amountLabel: 'Helpful Votes',
    quickAdvanceLabel: 'Mark Solved',
    quickAdvanceToStatus: 'Accepted Solution',
    fields: [
      { key: 'topicTag', label: 'Board', type: 'select', options: ['Orders & Delivery', 'Product Care', 'Wholesale & B2B', 'Warranty & Returns'] },
      { key: 'responder', label: 'Moderator', type: 'employee_select' },
    ],
    templates: [
      {
        label: 'Public B2B FAQ Thread',
        title: 'Requesting Corporate KRA PIN Invoices on Online Orders',
        subtitle: 'Enter your 11-digit KRA PIN at checkout to receive instant CUIN PDF',
        status: 'Accepted Solution',
        amount: 24,
        meta: { topicTag: 'Wholesale & B2B' },
      },
    ],
  },

  elearning: {
    moduleId: 'elearning',
    summaryMetricLabel: 'Enrolled Staff / Learners',
    statuses: ['Draft Course', 'Enrolling', 'Active Cohort', 'Certified'],
    titleLabel: 'Course / Onboarding Track',
    titlePlaceholder: 'e.g. LMS-101 · POS Register, Barcode Scanner & eTIMS Mastery',
    subtitlePlaceholder: 'Modules included, pass quiz score & certification badge',
    amountLabel: 'Enrolled Count',
    quickAdvanceLabel: 'Mark Certified',
    quickAdvanceToStatus: 'Certified',
    fields: [
      { key: 'instructor', label: 'Trainer / Lead', type: 'employee_select' },
      { key: 'durationMins', label: 'Duration (Mins)', type: 'number', placeholder: '45', defaultValue: 30 },
      { key: 'passMarkPct', label: 'Pass Score (%)', type: 'number', placeholder: '80', defaultValue: 80 },
    ],
    templates: [
      {
        label: 'New Cashier Certification',
        title: 'LMS-01 · Offline POS Checkout, M-Pesa STK & Receipt Verification',
        subtitle: 'Required before new staff receive POS drawer PIN permissions',
        status: 'Active Cohort',
        amount: 8,
        meta: { durationMins: 45, passMarkPct: 85 },
      },
    ],
  },

  events: {
    moduleId: 'events',
    summaryMetricLabel: 'Ticket Revenue',
    statuses: ['Planning', 'Tickets On Sale', 'Sold Out', 'Completed'],
    titleLabel: 'Event / Workshop Title',
    titlePlaceholder: 'e.g. EVT-2026 · Nairobi Artisan Coffee Cupping & Tasting',
    subtitlePlaceholder: 'Venue capacity, M-Pesa ticket pass & guest perks',
    amountLabel: 'Projected Ticket Revenue',
    autoCompute: 'qty_unit_cost',
    quickAdvanceLabel: 'Open Ticket Sales',
    quickAdvanceToStatus: 'Tickets On Sale',
    fields: [
      { key: 'venue', label: 'Venue / Branch', type: 'text', placeholder: 'Westlands Rooftop Terrace' },
      { key: 'eventDate', label: 'Event Date', type: 'date' },
      { key: 'qty', label: 'Seat Capacity', type: 'number', placeholder: '60', defaultValue: 40 },
      { key: 'unitCost', label: 'Ticket Price', type: 'number', placeholder: '1500', defaultValue: 1000 },
    ],
    templates: [
      {
        label: 'Customer Pop-Up / Workshop',
        title: 'EVT-12 · Weekend Tasting & Product Demo Pop-Up',
        subtitle: 'QR check-in at entrance + M-Pesa Express ticket checkout',
        status: 'Tickets On Sale',
        amount: 40000,
        meta: { venue: 'Main Branch Courtyard', qty: 40, unitCost: 1000 },
      },
    ],
  },
};
