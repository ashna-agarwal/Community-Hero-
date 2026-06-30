import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Comment, Notification, ActivityLog, VerificationRequest } from '../types';

// Offline detection state to dynamically fall back to local storage
let isFirebaseOffline = false;

// Check if we should use local storage fallback (when Firebase is unconfigured or offline)
const isLocalMode = (): boolean => {
  return !db || isFirebaseOffline;
};

// Generic error handler
const handleDBError = (action: string, error: any) => {
  console.error(`Database Error during [${action}]:`, error);
  throw new Error(`Database operations failed during ${action}: ${error.message || error}`);
};

/**
 * FIXED DEMO DATASET — static, do not regenerate
 * Pre-populates the local storage with real-world scenarios straight from the hackathon brief.
 */
const SEED_ISSUES: Issue[] = [
  {
    id: 'gurgaon-101',
    title: 'Deep Crater Potholes on NH-48 Service Lane',
    description: 'Three extremely deep crater potholes on the NH-48 service lane near IFFCO Chowk. Already caused multiple bike skid accidents. Very dangerous during waterlogging.',
    category: 'Potholes & Roads',
    department: 'Public Works Dept',
    status: 'In Progress',
    severity: 'Critical',
    priority: 'Critical',
    lat: 28.4712,
    lng: 77.0725,
    address: 'NH-48 Service Road, Near IFFCO Chowk Metro Station, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 145,
    voters: ['reporter-amit', 'reporter-divya'],
    assignedOfficerId: 'officer-rajesh',
    assignedOfficerName: 'Rajesh Kumar',
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 92,
    credibilityScore: 98,
    credibilityExplanation: 'Image analysis shows severe pavement erosion and deep structure damage. Location GPS matches.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-102',
    title: 'Sewage Overflow and Flooding in Sector 45',
    description: 'The primary sewer line near Artemis Hospital has ruptured. Extremely foul-smelling black water is flooding Sector 45 main lane, entering several houses.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'In Progress',
    severity: 'High',
    priority: 'High',
    lat: 28.4415,
    lng: 77.0621,
    address: 'Lane 4, Sector 45, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 92,
    voters: ['reporter-ashna'],
    assignedOfficerId: 'officer-sanjay',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: '2026-06-27T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 84,
    credibilityScore: 94,
    credibilityExplanation: 'Water contamination detected by spectral highlights. Stench and flooding hazard verified.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-103',
    title: 'Flickering Streetlights on Sector 54 Service Lane',
    description: 'All 12 streetlights on the Sector 54 service lane are completely dark. This stretch is extremely isolated and unsafe for women returning from metro late at night.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'Community Verification',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4285,
    lng: 77.1001,
    address: 'Golf Course Road Service Lane, Sector 54, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 78,
    voters: ['reporter-ashna', 'reporter-amit'],
    assignedOfficerId: 'officer-manoj',
    assignedOfficerName: 'Manoj Sinha',
    createdAt: '2026-06-04T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    beforeImageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
    afterImageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Replaced dead fluorescent bulbs with energy-efficient LED assemblies and checked supply line.',
    priorityScore: 45,
    credibilityScore: 89,
    credibilityExplanation: 'Night exposure confirms streetlight failure. AI vision validated replacement details with high accuracy.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 85
  },
  {
    id: 'gurgaon-104',
    title: 'Toxic Industrial Waste Dumping near Forest Border',
    description: 'Unidentified tankers are dumping commercial chemical sludge under the cover of night. Breeding chemical hazard and spreading chemical fumes.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'Submitted',
    severity: 'Critical',
    priority: 'High',
    lat: 28.4320,
    lng: 77.0180,
    address: 'Forest Boundary Road, Ward 8, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 210,
    voters: ['reporter-ashna'],
    createdAt: '2026-06-28T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 88,
    credibilityScore: 96,
    credibilityExplanation: 'AI chemical slurry inspection indicates critical hazard. Corrosive surface elements detected.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Action Pending',
    progressPercent: 20
  },
  {
    id: 'gurgaon-105',
    title: 'Water Main Valve Leakage in Sector 56 Huda Market',
    description: 'High pressure drinking water main valve is damaged and leaking massive quantities of clean water, flooding the market complex entrance.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'In Progress',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4355,
    lng: 77.0851,
    address: 'Sector 56 HUDA Market, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 45,
    voters: [],
    assignedOfficerId: 'officer-sanjay',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: '2026-06-25T10:00:00Z',
    updatedAt: '2026-06-27T10:00:00Z',
    priorityScore: 65,
    credibilityScore: 90,
    credibilityExplanation: 'Water spraying from valve joint. Leak rate analyzed from frame movement.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-106',
    title: 'Dangerous Open Wire Junction Box near Sukhrali',
    description: 'An electrical distribution panel has its steel door broken, leaving naked 440V copper cables exposed at shoulder level in a high pedestrian zone.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'Submitted',
    severity: 'Critical',
    priority: 'Critical',
    lat: 28.4752,
    lng: 77.0655,
    address: 'Main Market Road, Sukhrali, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 189,
    voters: [],
    createdAt: '2026-06-19T10:00:00Z',
    updatedAt: '2026-06-19T10:00:00Z',
    priorityScore: 95,
    credibilityScore: 98,
    credibilityExplanation: 'Naked wiring verified using visual node network. Serious electrocution risk confirmed.',
    escalationLevel: 2, // Escalated to Department Head due to 10 days delay
    escalationDate: '2026-06-26T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-107',
    title: 'Broken Interlocking Tiles at Leisure Valley Park',
    description: 'The senior citizen walkway inside Leisure Valley has collapsed tiles over 15 meters, making it extremely unsafe for morning walks.',
    category: 'Public Parks',
    department: 'Parks & Recreation',
    status: 'Resolved',
    severity: 'Low',
    priority: 'Low',
    lat: 28.4690,
    lng: 77.0675,
    address: 'Walking Track, Leisure Valley Park, Sector 29, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1141?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 32,
    voters: [],
    assignedOfficerId: 'officer-anil',
    assignedOfficerName: 'Anil Sharma',
    createdAt: '2026-06-14T10:00:00Z',
    updatedAt: '2026-06-27T10:00:00Z',
    beforeImageUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1141?auto=format&fit=crop&w=600&q=80',
    afterImageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Laid down brand new concrete interlocking tiles and leveled the ground beneath.',
    priorityScore: 35,
    credibilityScore: 91,
    credibilityExplanation: 'Displaced paving verified against park records.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 80
  },
  {
    id: 'gurgaon-108',
    title: 'Clogged Stormwater Drain causing Cyber City Flooding',
    description: 'The primary drainage conduit is completely filled with construction debris, causing the service lane next to Cyber City block to submerge in 2 feet of water.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'Submitted',
    severity: 'High',
    priority: 'High',
    lat: 28.4982,
    lng: 77.0882,
    address: 'DLF Cyber City Phase III Main Road, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 340,
    voters: [],
    createdAt: '2026-06-21T10:00:00Z',
    updatedAt: '2026-06-21T10:00:00Z',
    priorityScore: 89,
    credibilityScore: 93,
    credibilityExplanation: 'Widespread waterlogging verified by comparative drone maps.',
    escalationLevel: 1, // Escalated to Senior Officer
    escalationDate: '2026-06-28T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-109',
    title: 'Debris & Commercial Garbage Dump near Good Earth',
    description: 'A local builder has dumped three truckloads of dry concrete rubble, wooden boards, and construction trash directly onto the open public footpath.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'Submitted',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4190,
    lng: 77.0592,
    address: 'Vikas Marg, Sector 50, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 56,
    voters: [],
    createdAt: '2026-06-24T10:00:00Z',
    updatedAt: '2026-06-24T10:00:00Z',
    priorityScore: 58,
    credibilityScore: 87,
    credibilityExplanation: 'Construction waste heaps matched against building activity index.',
    escalationLevel: 1,
    escalationDate: '2026-06-28T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-110',
    title: 'Open Deep Manhole without Cover, Palam Vihar',
    description: 'A 6-foot deep main sewage manhole is left open without any concrete cover, warning sign, or barrier right in front of the local shopping lane.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'Submitted',
    severity: 'Critical',
    priority: 'Critical',
    lat: 28.4901,
    lng: 77.0322,
    address: 'Main Market Sector 2, Palam Vihar, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 290,
    voters: [],
    createdAt: '2026-06-17T10:00:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    priorityScore: 98,
    credibilityScore: 99,
    credibilityExplanation: 'Structural open hole verified with 99% accuracy. Immediate extreme safety hazard.',
    escalationLevel: 3, // Escalated to District Commissioner
    escalationDate: '2026-06-24T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-111',
    title: 'Damaged Swings and Broken Play Equipment',
    description: 'Three iron swings in Sector 14 park are completely rusted and broken, leaving sharp steel edges exposed. Multiple kids have cut themselves.',
    category: 'Public Parks',
    department: 'Parks & Recreation',
    status: 'Under Review',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4735,
    lng: 77.0495,
    address: 'Sector 14 Central Park, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1141?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 64,
    voters: [],
    assignedOfficerId: 'officer-anil',
    assignedOfficerName: 'Anil Sharma',
    createdAt: '2026-06-28T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 55,
    credibilityScore: 88,
    credibilityExplanation: 'Rust and damage detected inside playground zone bounds.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 30
  },
  {
    id: 'gurgaon-112',
    title: 'Fallen Overhead Power Cables at IFFCO Chowk Corner',
    description: 'A massive bundle of internet and television coaxial wires has snapped, hanging dangerously low across the pedestrian zebra crossing.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'In Progress',
    severity: 'High',
    priority: 'High',
    lat: 28.4705,
    lng: 77.0715,
    address: 'IFFCO Chowk Crossing, MG Road, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 112,
    voters: [],
    assignedOfficerId: 'officer-manoj',
    assignedOfficerName: 'Manoj Sinha',
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 82,
    credibilityScore: 92,
    credibilityExplanation: 'Snapping fiber cable strands detected by linear vector mapping.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-113',
    title: 'Piles of Plastic Waste in DLF Phase 3 lanes',
    description: 'Huge quantity of polythene packets, plastic food trays, and uncollected household trash is dumped in front of Sector U block lane.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'In Progress',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4912,
    lng: 77.0945,
    address: 'U-Block Lanes, DLF Phase 3, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 41,
    voters: [],
    assignedOfficerId: 'officer-karan',
    assignedOfficerName: 'Karan Singh',
    createdAt: '2026-06-27T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 61,
    credibilityScore: 86,
    credibilityExplanation: 'Uncontrolled plastic heaps identified on residential asphalt.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-114',
    title: 'Damaged Asphalt Road with Substructure Exposure',
    description: 'The primary crossing road in Sector 15 has completely chipped off, exposing raw stone ballast that punctures tyres daily.',
    category: 'Potholes & Roads',
    department: 'Public Works Dept',
    status: 'Submitted',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4622,
    lng: 77.0482,
    address: 'Sector 15 Main Crossing Road, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 38,
    voters: [],
    createdAt: '2026-06-27T10:00:00Z',
    updatedAt: '2026-06-27T10:00:00Z',
    priorityScore: 58,
    credibilityScore: 90,
    credibilityExplanation: 'Substructure aggregate exposed. Surface failure verified.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Action Pending',
    progressPercent: 20
  },
  {
    id: 'gurgaon-115',
    title: 'Water Leakage from Air Release Valve, Golf Course Ext',
    description: 'An air release valve on the main supply line has cracked, spraying water 10 feet high, wasting drinking water and creating a swamp.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'In Progress',
    severity: 'High',
    priority: 'Medium',
    lat: 28.4055,
    lng: 77.0782,
    address: 'Golf Course Extension Road, Sector 58, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 104,
    voters: [],
    assignedOfficerId: 'officer-sanjay',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 78,
    credibilityScore: 91,
    credibilityExplanation: 'Vapor plume and high-pressure jet stream verified on visual analysis.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-116',
    title: 'Dead Streetlights in Sector 82 Housing Zone',
    description: 'Four consecutive streetlights on the lane outside DLF Primus are dead. Snatchers are hiding in dark shrubs. Unsafe for night commuting.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'Under Review',
    severity: 'High',
    priority: 'High',
    lat: 28.3882,
    lng: 76.9745,
    address: 'Sector 82 Outer Access Road, near DLF Primus, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 88,
    voters: [],
    assignedOfficerId: 'officer-manoj',
    assignedOfficerName: 'Manoj Sinha',
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-26T10:00:00Z',
    priorityScore: 79,
    credibilityScore: 89,
    credibilityExplanation: 'Low brightness lux levels confirmed near coordinate.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 30
  },
  {
    id: 'gurgaon-117',
    title: 'Massive Waste Accumulation near Gurgaon Bus Stand',
    description: 'Unchecked domestic and organic waste dumped in huge piles outside the city interstate bus stand. It has blocked half of the service lane.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'Submitted',
    severity: 'High',
    priority: 'High',
    lat: 28.4715,
    lng: 77.0125,
    address: 'Old Gurgaon Bus Stand, Sector 12, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 110,
    voters: [],
    createdAt: '2026-06-14T10:00:00Z',
    updatedAt: '2026-06-14T10:00:00Z',
    priorityScore: 86,
    credibilityScore: 95,
    credibilityExplanation: 'Organic decomposing signatures found. Massive public sanitation risk.',
    escalationLevel: 2,
    escalationDate: '2026-06-24T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-118',
    title: 'Clogged Sewer Pipeline near Vyapar Kendra Sector 43',
    description: 'Sewer manhole is bubbling out septic waste onto the road right in front of the local pharmacy, causing unhygienic conditions.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'Submitted',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4522,
    lng: 77.0815,
    address: 'Vyapar Kendra Market lane, Sector 43, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 52,
    voters: [],
    createdAt: '2026-06-23T10:00:00Z',
    updatedAt: '2026-06-23T10:00:00Z',
    priorityScore: 66,
    credibilityScore: 88,
    credibilityExplanation: 'Septic backflow verified on coordinate. Image timestamp matches.',
    escalationLevel: 1,
    escalationDate: '2026-06-28T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-119',
    title: 'Major Cracks and Potholes on Golf Course Road',
    description: 'Several massive deep cracks have surfaced under the rapid metro line near Sector 53. Speeds have to drop to 10km/h, causing tailbacks.',
    category: 'Potholes & Roads',
    department: 'Public Works Dept',
    status: 'In Progress',
    severity: 'High',
    priority: 'High',
    lat: 28.4385,
    lng: 77.0965,
    address: 'Main Golf Course Road, Sector 53 Metro Station, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 121,
    voters: [],
    assignedOfficerId: 'officer-rajesh',
    assignedOfficerName: 'Rajesh Kumar',
    createdAt: '2026-06-24T10:00:00Z',
    updatedAt: '2026-06-27T10:00:00Z',
    priorityScore: 84,
    credibilityScore: 93,
    credibilityExplanation: 'Asphalt linear distress fracture validated on texture profile.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  },
  {
    id: 'gurgaon-120',
    title: 'Dead Streetlights in Sector 47 Netaji Subhash Marg',
    description: 'A 500-meter dark pocket on the road. Completely dead streetlights from central dividers. Extremely hazardous for cars turning.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'Submitted',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4215,
    lng: 77.0512,
    address: 'Netaji Subhash Marg, Sector 47, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 34,
    voters: [],
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-26T10:00:00Z',
    priorityScore: 52,
    credibilityScore: 85,
    credibilityExplanation: 'Zero ambient street-lux calculated from photo.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Action Pending',
    progressPercent: 20
  },
  {
    id: 'gurgaon-121',
    title: 'Waterlogged Pothole Zone on Sohna Road Corner',
    description: 'Heavy waterlogging has fully hidden three cavernous potholes at the corner near Subhash Chowk. Three vehicles suffered tyre damage yesterday.',
    category: 'Potholes & Roads',
    department: 'Public Works Dept',
    status: 'Submitted',
    severity: 'High',
    priority: 'High',
    lat: 28.4111,
    lng: 77.0425,
    address: 'Sohna Road, near Subhash Chowk, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 198,
    voters: [],
    createdAt: '2026-06-19T10:00:00Z',
    updatedAt: '2026-06-19T10:00:00Z',
    priorityScore: 91,
    credibilityScore: 97,
    credibilityExplanation: 'Water-filled road cavity validated by texture profiling.',
    escalationLevel: 2,
    escalationDate: '2026-06-26T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-122',
    title: 'Severe Drinking Water Leakage in Sector 15-II',
    description: 'A damaged supply valve is bubbling clean drinking water into the dirt service road, wasting large quantities and creating heavy sludge.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'Resolved',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4611,
    lng: 77.0505,
    address: 'Sector 15 Part II Main Entrance road, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 43,
    voters: [],
    assignedOfficerId: 'officer-sanjay',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: '2026-06-19T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    beforeImageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    afterImageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Secured the primary high pressure seal and replaced the corroded steel flange bolts.',
    priorityScore: 61,
    credibilityScore: 91,
    credibilityExplanation: 'Pressure leak verified. Seal repair successfully analyzed.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 80
  },
  {
    id: 'gurgaon-123',
    title: 'Broken Park Swings and Benches, Sector 31 HUDA Park',
    description: 'The perimeter benches are completely shattered, and two swings are hanging loosely by dangerous sharp steel chains. Very risky for children.',
    category: 'Public Parks',
    department: 'Parks & Recreation',
    status: 'Submitted',
    severity: 'Low',
    priority: 'Low',
    lat: 28.4551,
    lng: 77.0545,
    address: 'HUDA Park, Sector 31, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1141?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-amit',
    reporterName: 'Amit Shah',
    votesCount: 22,
    voters: [],
    createdAt: '2026-06-28T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 31,
    credibilityScore: 84,
    credibilityExplanation: 'Bench cracks verified by visual bounding box check.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Action Pending',
    progressPercent: 20
  },
  {
    id: 'gurgaon-124',
    title: 'Clogged Sewage Pipeline near Palam Vihar Sector 1',
    description: 'Sewer backwater is flowing into residential lanes because of illegal heavy plastic blocking the main stormwater pipe.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'Submitted',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4952,
    lng: 77.0345,
    address: 'Sector 1 Pocket C Road, Palam Vihar, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-divya',
    reporterName: 'Divya Sharma',
    votesCount: 44,
    voters: [],
    createdAt: '2026-06-26T10:00:00Z',
    updatedAt: '2026-06-26T10:00:00Z',
    priorityScore: 62,
    credibilityScore: 88,
    credibilityExplanation: 'Liquid surface level verified with reference elevation marks.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Action Pending',
    progressPercent: 20
  },
  {
    id: 'gurgaon-125',
    title: 'Industrial Chemical Slurry Dump in Sector 10A Area',
    description: 'Heavy toxic sludge containing dark oily residue has been illegally discharged on the road boundary, killing local roadside green patches.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'Submitted',
    severity: 'Critical',
    priority: 'High',
    lat: 28.4411,
    lng: 77.0101,
    address: 'Industrial Area Road, Sector 10A, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-karan',
    reporterName: 'Karan Mehra',
    votesCount: 165,
    voters: [],
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-06-15T10:00:00Z',
    priorityScore: 87,
    credibilityScore: 94,
    credibilityExplanation: 'AI fluid viscosity detection indicates high toxic density markers.',
    escalationLevel: 2,
    escalationDate: '2026-06-25T10:00:00Z',
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'Ignored / Delayed',
    progressPercent: 10
  },
  {
    id: 'gurgaon-126',
    title: 'Severe Street Submersion on Golf Course Extension',
    description: 'Major storm drains are completely choked with construction mortar. The entire cross junction has submerged in stagnant sewer and rainwater.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'In Progress',
    severity: 'Critical',
    priority: 'Critical',
    lat: 28.4022,
    lng: 77.0752,
    address: 'Golf Course Extension Road Cross Road, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-ashna',
    reporterName: 'Ashna Agarwal',
    votesCount: 380,
    voters: [],
    assignedOfficerId: 'officer-sanjay',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: '2026-06-25T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    priorityScore: 96,
    credibilityScore: 98,
    credibilityExplanation: 'Submerged asphalt visual matching indicates water depth exceeds 18 inches.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1,
    actionClassification: 'In the Works',
    progressPercent: 60
  }
];

const SEED_COMMENTS: Record<string, Comment[]> = {
  'gurgaon-101': [
    {
      id: 'c-1',
      issueId: 'gurgaon-101',
      userId: 'reporter-ashna',
      userName: 'Ashna Agarwal',
      userRole: 'Citizen',
      text: 'This is getting worse daily. The crater potholes are practically submerging under rainwater when it pours.',
      createdAt: '2026-06-26T10:00:00Z'
    },
    {
      id: 'c-2',
      issueId: 'gurgaon-101',
      userId: 'officer-rajesh',
      userName: 'Rajesh Kumar',
      userRole: 'Officer',
      text: 'We have registered this. Repairs will initiate as soon as the rain lets up.',
      createdAt: '2026-06-28T10:00:00Z'
    }
  ],
  'gurgaon-102': [
    {
      id: 'c-3',
      issueId: 'gurgaon-102',
      userId: 'reporter-amit',
      userName: 'Amit Shah',
      userRole: 'Citizen',
      text: 'The sewage water has started flowing into our building basements. Please dispatch sewer pumps!',
      createdAt: '2026-06-27T10:00:00Z'
    }
  ]
};

const SEED_LOGS: Record<string, ActivityLog[]> = {
  'gurgaon-101': [
    {
      id: 'log-1',
      issueId: 'gurgaon-101',
      userId: 'reporter-ashna',
      userName: 'Ashna Agarwal',
      action: 'Reported issue and completed AI verification.',
      createdAt: '2026-06-26T10:00:00Z'
    },
    {
      id: 'log-2',
      issueId: 'gurgaon-101',
      userId: 'officer-rajesh',
      userName: 'Rajesh Kumar',
      action: 'Assigned roads division team and approved materials list.',
      createdAt: '2026-06-28T10:00:00Z'
    }
  ]
};

const SEED_VERIFICATION_REQUESTS: Record<string, VerificationRequest[]> = {
  'gurgaon-103': [
    {
      id: 'vr-1',
      issueId: 'gurgaon-103',
      officerId: 'officer-manoj',
      officerName: 'Manoj Sinha',
      afterImageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
      notes: 'All streetlights are now fully functional. Replaced bulbs with LED nodes.',
      votesVerified: 2,
      votesRejected: 0,
      voters: { 'reporter-ashna': true, 'reporter-amit': true },
      createdAt: '2026-06-28T10:00:00Z',
      status: 'Pending'
    }
  ]
};

// Initialize Offline LocalStorage Db if not pre-seeded
const initLocalStorageDb = () => {
  if (!localStorage.getItem('ch_local_issues')) {
    localStorage.setItem('ch_local_issues', JSON.stringify(SEED_ISSUES));
  }
  if (!localStorage.getItem('ch_local_comments')) {
    localStorage.setItem('ch_local_comments', JSON.stringify(SEED_COMMENTS));
  }
  if (!localStorage.getItem('ch_local_logs')) {
    localStorage.setItem('ch_local_logs', JSON.stringify(SEED_LOGS));
  }
  if (!localStorage.getItem('ch_local_vreqs')) {
    localStorage.setItem('ch_local_vreqs', JSON.stringify(SEED_VERIFICATION_REQUESTS));
  }
  if (!localStorage.getItem('ch_local_notifs')) {
    localStorage.setItem('ch_local_notifs', JSON.stringify([]));
  }
};

initLocalStorageDb();

/**
 * OFFLINE COMPATIBILITY HELPERS
 */
const getLocalIssues = (): Issue[] => {
  initLocalStorageDb();
  return JSON.parse(localStorage.getItem('ch_local_issues') || '[]');
};

const saveLocalIssues = (issues: Issue[]) => {
  localStorage.setItem('ch_local_issues', JSON.stringify(issues));
};

/**
 * CENTRAL DATABASE INTERACTION SUITE (WITH DUAL-PATH FALLBACK)
 */

export const dbCreateIssue = async (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const id = `issue-${Math.random().toString(36).substring(2, 9)}`;
    const newIssue: Issue = {
      ...issue,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to mock issues
    const issues = getLocalIssues();
    issues.unshift(newIssue);
    saveLocalIssues(issues);

    // Save activity log
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    if (!localLogs[id]) localLogs[id] = [];
    localLogs[id].push({
      id: `log-${Date.now()}`,
      issueId: id,
      userId: issue.reporterId,
      userName: issue.reporterName,
      action: 'Reported issue and completed AI verification.',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));

    // Save notification
    const localNotifs = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    localNotifs.push({
      id: `notif-${Date.now()}`,
      userId: issue.reporterId,
      title: 'Report Registered',
      message: `Your report "${issue.title}" has been successfully logged with Priority Score: ${issue.priorityScore || 50}.`,
      issueId: id,
      type: 'Status Changed',
      read: false,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));

    return id;
  }

  // FIRESTORE FLOW
  try {
    const issueRef = doc(collection(db!, 'issues'));
    const newIssue: Issue = {
      ...issue,
      id: issueRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(issueRef, newIssue);

    // Write initial Activity Log
    const logRef = doc(collection(db!, `issues/${issueRef.id}/activityLogs`));
    const initLog: ActivityLog = {
      id: logRef.id,
      issueId: issueRef.id,
      userId: issue.reporterId,
      userName: issue.reporterName,
      action: 'Reported issue and initiated AI triage.',
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, initLog);

    // Create system notification
    const notifRef = doc(collection(db!, 'notifications'));
    const initNotif: Notification = {
      id: notifRef.id,
      userId: issue.reporterId,
      title: 'Report Submitted',
      message: `Your report "${issue.title}" has been submitted successfully to ${issue.department}.`,
      issueId: issueRef.id,
      type: 'Status Changed',
      read: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(notifRef, initNotif);

    return issueRef.id;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbCreateIssue failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const id = `issue-${Math.random().toString(36).substring(2, 9)}`;
    const newIssue: Issue = {
      ...issue,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const issues = getLocalIssues();
    issues.unshift(newIssue);
    saveLocalIssues(issues);
    return id;
  }
};

export const dbSeedFirestoreData = async (): Promise<Issue[]> => {
  if (!db) {
    console.warn('[Community Hero] Firestore is not configured or initialized.');
    return SEED_ISSUES;
  }
  try {
    console.log('[Community Hero] Seeding Firestore with realistic Gurgaon dataset...');
    const issuesCollection = collection(db, 'issues');
    
    // Seed departments to ensure perfect alignment!
    const depts = [
      { id: 'roads', name: 'Public Works Dept', officerCount: 3, resolvedCount: 14, activeCount: 6 },
      { id: 'sewage', name: 'Water & Sewage Authority', officerCount: 4, resolvedCount: 18, activeCount: 8 },
      { id: 'electricity', name: 'Traffic Engineering', officerCount: 2, resolvedCount: 9, activeCount: 4 },
      { id: 'sanitation', name: 'Sanitation Department', officerCount: 3, resolvedCount: 11, activeCount: 5 },
      { id: 'parks', name: 'Parks & Recreation', officerCount: 2, resolvedCount: 7, activeCount: 2 }
    ];
    
    for (const dept of depts) {
      try {
        await setDoc(doc(db, 'departments', dept.id), dept);
      } catch (err: any) {
        console.error(`[Community Hero Seeding] Failed writing department ${dept.id}:`, err);
        throw err;
      }
    }
    
    // Seed users (profiles)
    const seedUsers = [
      { uid: 'reporter-ashna', name: 'Ashna Agarwal', email: 'ashna@gurgaon.gov.in', role: 'Citizen', reputation: 350, badges: ['Civic Champion', 'First Responder'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'reporter-amit', name: 'Amit Shah', email: 'amit@gurgaon.gov.in', role: 'Citizen', reputation: 180, badges: ['Neighborhood Watch'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'reporter-divya', name: 'Divya Sharma', email: 'divya@gurgaon.gov.in', role: 'Citizen', reputation: 210, badges: ['Green Guard'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'reporter-karan', name: 'Karan Mehra', email: 'karan@gurgaon.gov.in', role: 'Citizen', reputation: 95, badges: ['Active Citizen'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      
      { uid: 'officer-rajesh', name: 'Rajesh Kumar', email: 'rajesh@gurgaon.gov.in', role: 'Officer', departmentId: 'roads', reputation: 120, badges: ['Speedy Fixer'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'officer-sanjay', name: 'Sanjay Dutt', email: 'sanjay@gurgaon.gov.in', role: 'Officer', departmentId: 'sewage', reputation: 250, badges: ['Plumbing Master', 'Hero of Gurgaon'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'officer-manoj', name: 'Manoj Sinha', email: 'manoj@gurgaon.gov.in', role: 'Officer', departmentId: 'electricity', reputation: 80, badges: ['Safety First'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'officer-karan', name: 'Karan Singh', email: 'karansingh@gurgaon.gov.in', role: 'Officer', departmentId: 'sanitation', reputation: 140, badges: ['Clean City Ambassador'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { uid: 'officer-anil', name: 'Anil Sharma', email: 'anil@gurgaon.gov.in', role: 'Officer', departmentId: 'parks', reputation: 90, badges: ['Green Thumb'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    
    for (const u of seedUsers) {
      try {
        await setDoc(doc(db, 'users', u.uid), u);
      } catch (err: any) {
        console.error(`[Community Hero Seeding] Failed writing user profile ${u.uid}:`, err);
        throw err;
      }
    }

    // Seed issues
    for (const issue of SEED_ISSUES) {
      const issueDocRef = doc(issuesCollection, issue.id);
      try {
        await setDoc(issueDocRef, issue);
      } catch (err: any) {
        console.error(`[Community Hero Seeding] Failed writing issue ${issue.id}:`, err);
        throw err;
      }
      
      // Seed activity logs and comments/verification requests if necessary
      if (issue.id === 'gurgaon-101') {
        const logRef = doc(db, `issues/${issue.id}/activityLogs`, 'log-1');
        try {
          await setDoc(logRef, {
            id: 'log-1',
            issueId: issue.id,
            userId: 'reporter-ashna',
            userName: 'Ashna Agarwal',
            action: 'Reported issue and completed AI verification.',
            createdAt: issue.createdAt
          });
        } catch (err: any) {
          console.error(`[Community Hero Seeding] Failed writing activityLog log-1 for issue ${issue.id}:`, err);
          throw err;
        }
        
        const logRef2 = doc(db, `issues/${issue.id}/activityLogs`, 'log-2');
        try {
          await setDoc(logRef2, {
            id: 'log-2',
            issueId: issue.id,
            userId: 'officer-rajesh',
            userName: 'Rajesh Kumar',
            action: 'Assigned roads division team and approved materials list.',
            createdAt: '2026-06-28T10:00:00Z'
          });
        } catch (err: any) {
          console.error(`[Community Hero Seeding] Failed writing activityLog log-2 for issue ${issue.id}:`, err);
          throw err;
        }
      }
      
      if (issue.id === 'gurgaon-103') {
        const vreqRef = doc(db, `issues/${issue.id}/verificationRequests`, 'vr-1');
        try {
          await setDoc(vreqRef, {
            id: 'vr-1',
            issueId: issue.id,
            officerId: 'officer-manoj',
            officerName: 'Manoj Sinha',
            afterImageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
            notes: 'All streetlights are now fully functional. Replaced bulbs with LED nodes.',
            votesVerified: 2,
            votesRejected: 0,
            voters: { 'reporter-ashna': true, 'reporter-amit': true },
            createdAt: '2026-06-28T10:00:00Z',
            status: 'Pending'
          });
        } catch (err: any) {
          console.error(`[Community Hero Seeding] Failed writing verificationRequest vr-1 for issue ${issue.id}:`, err);
          throw err;
        }
      }
    }
    
    console.log('[Community Hero] Seeding complete! All 26 complaints successfully written to Firestore.');
    return SEED_ISSUES;
  } catch (err) {
    console.error('[Community Hero] Error seeding Firestore:', err);
    return SEED_ISSUES;
  }
};

export const dbGetIssues = async (): Promise<Issue[]> => {
  if (isLocalMode()) {
    return getLocalIssues();
  }

  try {
    const q = query(collection(db!, 'issues'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const list: Issue[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Issue);
    });
    
    if (list.length === 0) {
      const seeded = await dbSeedFirestoreData();
      return seeded;
    }
    return list;
  } catch (err) {
    console.warn('Firestore getIssues failed, falling back to local seed data:', err);
    return getLocalIssues();
  }
};

export const dbGetMyIssues = async (userId: string): Promise<Issue[]> => {
  if (isLocalMode()) {
    return getLocalIssues().filter(i => i.reporterId === userId);
  }

  try {
    const q = query(
      collection(db!, 'issues'), 
      where('reporterId', '==', userId), 
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const list: Issue[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Issue);
    });
    return list;
  } catch (err) {
    console.warn('Firestore getMyIssues failed, falling back to local mock filtering.');
    return getLocalIssues().filter(i => i.reporterId === userId);
  }
};

export const dbGetIssueById = async (id: string): Promise<Issue | null> => {
  if (isLocalMode()) {
    return getLocalIssues().find(i => i.id === id) || null;
  }

  try {
    const docSnap = await getDoc(doc(db!, 'issues', id));
    return docSnap.exists() ? (docSnap.data() as Issue) : (getLocalIssues().find(i => i.id === id) || null);
  } catch (err) {
    return getLocalIssues().find(i => i.id === id) || null;
  }
};

export const dbUpdateIssueStatus = async (
  issueId: string, 
  status: Issue['status'], 
  actorId: string, 
  actorName: string,
  extraData?: Partial<Issue>
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status,
        updatedAt: new Date().toISOString(),
        ...extraData
      };
      saveLocalIssues(issues);

      // Audit Trail Log
      const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
      if (!localLogs[issueId]) localLogs[issueId] = [];
      localLogs[issueId].push({
        id: `log-${Date.now()}`,
        issueId,
        userId: actorId,
        userName: actorName,
        action: `Status updated to [${status}]. ${extraData?.resolutionNotes ? 'Resolution Notes: ' + extraData.resolutionNotes : ''}`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));

      // Notification
      const localNotifs = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
      localNotifs.push({
        id: `notif-${Date.now()}`,
        userId: issues[index].reporterId,
        title: 'Status Action Logged',
        message: `Your report "${issues[index].title}" has updated to: ${status}`,
        issueId,
        type: 'Status Changed',
        read: false,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const updatePayload: Partial<Issue> = {
      status,
      updatedAt: new Date().toISOString(),
      ...extraData
    };
    await updateDoc(issueRef, updatePayload);

    // Audit Trail Log
    const logRef = doc(collection(db!, `issues/${issueId}/activityLogs`));
    const log: ActivityLog = {
      id: logRef.id,
      issueId,
      userId: actorId,
      userName: actorName,
      action: `Status updated to [${status}].`,
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, log);

    // Create Notification
    const issueSnap = await getDoc(issueRef);
    if (issueSnap.exists()) {
      const issueData = issueSnap.data() as Issue;
      const notifRef = doc(collection(db!, 'notifications'));
      const notification: Notification = {
        id: notifRef.id,
        userId: issueData.reporterId,
        title: 'Issue Update',
        message: `Your report "${issueData.title}" status changed to ${status}.`,
        issueId,
        type: 'Status Changed',
        read: false,
        createdAt: new Date().toISOString()
      };
      await setDoc(notifRef, notification);
    }
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbUpdateIssueStatus failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status,
        updatedAt: new Date().toISOString(),
        ...extraData
      };
      saveLocalIssues(issues);
    }
  }
};

export const dbSupportIssue = async (issueId: string, userId: string): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      const voterIndex = issues[index].voters.indexOf(userId);
      if (voterIndex !== -1) {
        // Toggle off (unlike)
        issues[index].voters.splice(voterIndex, 1);
      } else {
        // Toggle on (like)
        issues[index].voters.push(userId);
      }
      issues[index].votesCount = issues[index].voters.length;
      
      // Recalculate priority score based on voters
      if (issues[index].priorityScore !== undefined) {
        const baseSeverity = issues[index].severity === 'Critical' ? 40 : issues[index].severity === 'High' ? 30 : issues[index].severity === 'Medium' ? 20 : 10;
        issues[index].priorityScore = Math.min(99, baseSeverity + issues[index].votesCount + (issues[index].affectedCount || 1) / 10);
      }

      saveLocalIssues(issues);
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const snap = await getDoc(issueRef);
    if (!snap.exists()) return;

    const issue = snap.data() as Issue;
    let updatedVoters: string[];
    const voterIndex = issue.voters.indexOf(userId);
    if (voterIndex !== -1) {
      // Toggle off (unlike)
      updatedVoters = issue.voters.filter(uid => uid !== userId);
    } else {
      // Toggle on (like)
      updatedVoters = [...issue.voters, userId];
    }
    
    await updateDoc(issueRef, {
      voters: updatedVoters,
      votesCount: updatedVoters.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbSupportIssue failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      const voterIndex = issues[index].voters.indexOf(userId);
      if (voterIndex !== -1) {
        issues[index].voters.splice(voterIndex, 1);
      } else {
        issues[index].voters.push(userId);
      }
      issues[index].votesCount = issues[index].voters.length;
      if (issues[index].priorityScore !== undefined) {
        const baseSeverity = issues[index].severity === 'Critical' ? 40 : issues[index].severity === 'High' ? 30 : issues[index].severity === 'Medium' ? 20 : 10;
        issues[index].priorityScore = Math.min(99, baseSeverity + issues[index].votesCount + (issues[index].affectedCount || 1) / 10);
      }
      saveLocalIssues(issues);
    }
  }
};

/**
 * COMMENTS SERVICES
 */
export const dbAddComment = async (issueId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    if (!localComments[issueId]) localComments[issueId] = [];

    const newComment: Comment = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localComments[issueId].push(newComment);
    localStorage.setItem('ch_local_comments', JSON.stringify(localComments));
    return newComment;
  }

  try {
    const commentRef = doc(collection(db!, `issues/${issueId}/comments`));
    const newComment: Comment = {
      ...comment,
      id: commentRef.id,
      createdAt: new Date().toISOString()
    };
    await setDoc(commentRef, newComment);

    await updateDoc(doc(db!, 'issues', issueId), {
      updatedAt: new Date().toISOString()
    });

    return newComment;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbAddComment failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    if (!localComments[issueId]) localComments[issueId] = [];
    const newComment: Comment = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localComments[issueId].push(newComment);
    localStorage.setItem('ch_local_comments', JSON.stringify(localComments));
    return newComment;
  }
};

export const dbGetComments = async (issueId: string): Promise<Comment[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    return localComments[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/comments`), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const list: Comment[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Comment);
    });
    return list;
  } catch (err) {
    console.warn('Firestore comments load failed, falling back to local.');
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    return localComments[issueId] || [];
  }
};

/**
 * AUDIT TRAIL LOGS
 */
export const dbGetActivityLogs = async (issueId: string): Promise<ActivityLog[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    return localLogs[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/activityLogs`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: ActivityLog[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as ActivityLog);
    });
    return list;
  } catch (err) {
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    return localLogs[issueId] || [];
  }
};

/**
 * DOUBLE-BLIND COMMUNITY VERIFICATION
 */
export const dbCreateVerificationRequest = async (
  issueId: string, 
  request: Omit<VerificationRequest, 'id' | 'votesVerified' | 'votesRejected' | 'voters' | 'createdAt' | 'status'>
): Promise<string> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    if (!localVReqs[issueId]) localVReqs[issueId] = [];

    const id = `vr-${Date.now()}`;
    const newRequest: VerificationRequest = {
      ...request,
      id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    localVReqs[issueId].unshift(newRequest);
    localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));

    // Update Issue status
    await dbUpdateIssueStatus(issueId, 'Community Verification', request.officerId, request.officerName, {
      afterImageUrl: request.afterImageUrl,
      resolutionNotes: request.notes
    });

    return id;
  }

  try {
    const reqRef = doc(collection(db!, `issues/${issueId}/verificationRequests`));
    const newRequest: VerificationRequest = {
      ...request,
      id: reqRef.id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    await setDoc(reqRef, newRequest);

    await dbUpdateIssueStatus(issueId, 'Community Verification', request.officerId, request.officerName, {
      afterImageUrl: request.afterImageUrl,
      resolutionNotes: request.notes
    });

    return reqRef.id;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbCreateVerificationRequest failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    if (!localVReqs[issueId]) localVReqs[issueId] = [];
    const id = `vr-${Date.now()}`;
    const newRequest: VerificationRequest = {
      ...request,
      id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    localVReqs[issueId].unshift(newRequest);
    localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
    
    // Fallback status update
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status: 'Community Verification',
        updatedAt: new Date().toISOString(),
        afterImageUrl: request.afterImageUrl,
        resolutionNotes: request.notes
      };
      saveLocalIssues(issues);
    }
    return id;
  }
};

export const dbGetVerificationRequests = async (issueId: string): Promise<VerificationRequest[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    return localVReqs[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/verificationRequests`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: VerificationRequest[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as VerificationRequest);
    });
    return list;
  } catch (err) {
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    return localVReqs[issueId] || [];
  }
};

export const dbVoteVerification = async (
  issueId: string,
  requestId: string,
  userId: string,
  verify: boolean // true = verify, false = dispute
): Promise<void> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    const reqsList: VerificationRequest[] = localVReqs[issueId] || [];
    const index = reqsList.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = reqsList[index];
      if (userId in request.voters) return; // already voted

      request.voters[userId] = verify;
      if (verify) {
        request.votesVerified += 1;
      } else {
        request.votesRejected += 1;
      }

      if (request.votesVerified >= 3) {
        request.status = 'Approved';
        await dbUpdateIssueStatus(issueId, 'Verified', 'community', 'Community Verification Success', {
          status: 'Verified'
        });
      } else if (request.votesRejected >= 2) {
        request.status = 'Disputed';
        await dbUpdateIssueStatus(issueId, 'Under Review', 'community', 'Community Dispute Initiated', {
          status: 'Under Review'
        });
      }

      localVReqs[issueId] = reqsList;
      localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
    }
    return;
  }

  try {
    const reqRef = doc(db!, `issues/${issueId}/verificationRequests`, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return;

    const request = snap.data() as VerificationRequest;
    if (userId in request.voters) return;

    const updatedVoters = { ...request.voters, [userId]: verify };
    let votesVerified = request.votesVerified;
    let votesRejected = request.votesRejected;

    if (verify) {
      votesVerified += 1;
    } else {
      votesRejected += 1;
    }

    let status = request.status;
    if (votesVerified >= 3) {
      status = 'Approved';
      await dbUpdateIssueStatus(issueId, 'Verified', 'community', 'Community Consensus', {
        status: 'Verified'
      });
    } else if (votesRejected >= 2) {
      status = 'Disputed';
      await dbUpdateIssueStatus(issueId, 'Under Review', 'community', 'Community Rejection Audit', {
        status: 'Under Review'
      });
    }

    await updateDoc(reqRef, {
      voters: updatedVoters,
      votesVerified,
      votesRejected,
      status
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbVoteVerification failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    const reqsList: VerificationRequest[] = localVReqs[issueId] || [];
    const index = reqsList.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = reqsList[index];
      if (!(userId in request.voters)) {
        request.voters[userId] = verify;
        if (verify) {
          request.votesVerified += 1;
        } else {
          request.votesRejected += 1;
        }
        if (request.votesVerified >= 3) {
          request.status = 'Approved';
          const issues = getLocalIssues();
          const idx = issues.findIndex(i => i.id === issueId);
          if (idx !== -1) {
            issues[idx].status = 'Verified';
            saveLocalIssues(issues);
          }
        } else if (request.votesRejected >= 2) {
          request.status = 'Disputed';
          const issues = getLocalIssues();
          const idx = issues.findIndex(i => i.id === issueId);
          if (idx !== -1) {
            issues[idx].status = 'Under Review';
            saveLocalIssues(issues);
          }
        }
        localVReqs[issueId] = reqsList;
        localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
      }
    }
  }
};

/**
 * NOTIFICATIONS
 */
export const dbGetMyNotifications = async (userId: string): Promise<Notification[]> => {
  if (isLocalMode()) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    return localNotifs.filter(n => n.userId === userId);
  }

  try {
    const q = query(
      collection(db!, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    const list: Notification[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Notification);
    });
    return list;
  } catch (err) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    return localNotifs.filter(n => n.userId === userId);
  }
};

export const dbMarkNotificationRead = async (id: string): Promise<void> => {
  if (isLocalMode()) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    const index = localNotifs.findIndex(n => n.id === id);
    if (index !== -1) {
      localNotifs[index].read = true;
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
    return;
  }

  try {
    await updateDoc(doc(db!, 'notifications', id), { read: true });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbMarkNotificationRead failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    const index = localNotifs.findIndex(n => n.id === id);
    if (index !== -1) {
      localNotifs[index].read = true;
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
  }
};

/**
 * CITIZEN PLEDGING FOR DIRECT ACTION (GAP SOLVER)
 */
export const dbAddCommunityPledge = async (
  issueId: string, 
  pledge: { userId: string; userName: string; hours?: number; pledgeType: 'labor' | 'supplies' | 'cleanup' | 'donation'; notes?: string }
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      if (!issues[idx].communityPledges) {
        issues[idx].communityPledges = [];
      }
      issues[idx].communityPledges!.push(pledge);
      issues[idx].updatedAt = new Date().toISOString();
      saveLocalIssues(issues);

      // Log in Audit Trail
      const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
      if (!localLogs[issueId]) localLogs[issueId] = [];
      localLogs[issueId].push({
        id: `log-${Date.now()}`,
        issueId,
        userId: pledge.userId,
        userName: pledge.userName,
        action: `Pledged support: ${pledge.pledgeType.toUpperCase()} ${pledge.hours ? `(${pledge.hours} hours)` : ''} - "${pledge.notes || ''}"`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const snap = await getDoc(issueRef);
    if (snap.exists()) {
      const issueData = snap.data() as Issue;
      const pledges = issueData.communityPledges || [];
      pledges.push(pledge);
      await updateDoc(issueRef, {
        communityPledges: pledges,
        updatedAt: new Date().toISOString()
      });

      // Write Activity Log
      const logRef = doc(collection(db!, `issues/${issueId}/activityLogs`));
      await setDoc(logRef, {
        id: logRef.id,
        issueId,
        userId: pledge.userId,
        userName: pledge.userName,
        action: `Pledged support: ${pledge.pledgeType.toUpperCase()} ${pledge.hours ? `(${pledge.hours} hours)` : ''} - "${pledge.notes || ''}"`,
        createdAt: new Date().toISOString()
      });
    }
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbAddCommunityPledge failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      if (!issues[idx].communityPledges) {
        issues[idx].communityPledges = [];
      }
      issues[idx].communityPledges!.push(pledge);
      saveLocalIssues(issues);
    }
  }
};

/**
 * AI MATERIALS ESTIMATE FEEDBACK (GAP SOLVER)
 */
export const dbUpdateMaterialsEstimate = async (
  issueId: string,
  materialsEstimate: Issue['materialsEstimate']
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      issues[idx].materialsEstimate = materialsEstimate;
      issues[idx].updatedAt = new Date().toISOString();
      saveLocalIssues(issues);
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    await updateDoc(issueRef, {
      materialsEstimate,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbUpdateMaterialsEstimate failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      issues[idx].materialsEstimate = materialsEstimate;
      saveLocalIssues(issues);
    }
  }
};

