import {
    Activity,
    BarChart3,
    CalendarCheck,
    ChartColumnIncreasing,
    ClipboardCheck,
    ClipboardList,
    Factory,
    FlaskConical,
    Gauge,
    Home,
    Layers3,
    PackageCheck,
    Radar,
    Scale,
    ShieldCheck,
    TableProperties,
    Target,
    TestTube2,
    Wrench,
    Zap,
    type LucideIcon,
} from 'lucide-react';

export type SectionId = 'home' | 'task-management' | 'ipqc' | 'quality-analysis';

export interface NavigationChildItem {
    id: string;
    label: string;
    path: string;
    description: string;
    icon: LucideIcon;
}

export interface NavigationSection {
    id: SectionId;
    label: string;
    path: string;
    description: string;
    icon: LucideIcon;
    children: NavigationChildItem[];
    emptyStateTitle?: string;
    emptyStateDescription?: string;
}

export const sectionNavigation: NavigationSection[] = [
    {
        id: 'home',
        label: 'Home',
        path: '/home',
        description: 'Open the Quality Portal home page.',
        icon: Home,
        children: [],
    },
    {
        id: 'task-management',
        label: 'Task Management',
        path: '/task-management',
        description: 'Manage daily tasks, meeting actions, and quality department goals in one place.',
        icon: ClipboardList,
        children: [
            {
                id: 'daily-meeting',
                label: 'Daily Meeting',
                path: '/daily-meeting',
                description: 'Track daily discussion points, action items, ownership, and follow-ups.',
                icon: CalendarCheck,
            },
            {
                id: 'goal-meeting',
                label: 'Goal Meeting',
                path: '/goal-meeting',
                description: 'Review department goals, progress updates, responsibilities, and target completion.',
                icon: Target,
            },
        ],
    },
    {
        id: 'ipqc',
        label: 'IPQC',
        path: '/ipqc',
        description: 'Access IPQC test records, inspection reports, audits, and process verification forms.',
        icon: FlaskConical,
        children: [
            {
                id: 'ipqc-audit',
                label: 'IPQC Audits',
                path: '/ipqc-audits',
                description: 'Review IPQC audit observations, checkpoints, and quality compliance status.',
                icon: ShieldCheck,
            },
            {
                id: 'stringer-parameter-report',
                label: 'Stringer Parameter Report',
                path: '/stringer-parameter-report',
                description: 'Review synchronized Stringer parameters, maintain report-only fields, and export monthly workbooks.',
                icon: TableProperties,
            },
            {
                id: 'adhesion-test',
                label: 'Adhesion Test',
                path: '/adhesion-test',
                description: 'Record adhesion inspection readings, remarks, approvals, and report history.',
                icon: ClipboardCheck,
            },
            {
                id: 'bus-ribbon-pull-strength',
                label: 'Bus Ribbon to INTC Ribbon Pull Strength Test',
                path: '/bus-ribbon-pull-strength',
                description: 'Record pull strength readings, remarks, approvals, and export reports.',
                icon: Gauge,
            },
            {
                id: 'frame-sealant-wt',
                label: 'Frame Sealant Weight Report',
                path: '/frame-sealant-wt',
                description: 'Capture frame sealant weight checks, remarks, and verification records.',
                icon: Scale,
            },
            {
                id: 'gel-test',
                label: 'Gel Content Test',
                path: '/gel-test',
                description: 'Record gel content readings, inspection status, approvals, and reports.',
                icon: TestTube2,
            },
            {
                id: 'jb-contact-block-maintenance',
                label: 'JB Contact Block Maintenance Report',
                path: '/jb-contact-block-maintenance',
                description: 'Maintain JB contact block checks with resistance, tension, remarks, and verification.',
                icon: Wrench,
            },
            {
                id: 'jb-sealant-wt',
                label: 'JB Sealant Weight Measurement',
                path: '/jb-sealant-wt',
                description: 'Track junction box sealant weight readings, remarks, and approval status.',
                icon: Scale,
            },
            {
                id: 'peel-strength-bus-ribbon-jb-soldering',
                label: 'Peel Strength of Bus Ribbon to JB Soldering Test Report',
                path: '/peel-strength-bus-ribbon-jb-soldering',
                description: 'Capture peel strength readings with date-wise inspection data.',
                icon: Activity,
            },
            {
                id: 'potting',
                label: 'Potting Ratio Measurement',
                path: '/potting',
                description: 'Record potting ratio checks, process readings, and verification remarks.',
                icon: Layers3,
            },
            {
                id: 'rot-test',
                label: 'Robustness of Termination Test',
                path: '/rot-test',
                description: 'Document termination robustness checks, readings, and report approvals.',
                icon: Zap,
            },
            {
                id: 'ssh-test',
                label: 'Sealant Shore Hardness Test',
                path: '/ssh-test',
                description: 'Capture sealant hardness values, inspection notes, and quality status.',
                icon: Radar,
            },
            {
                id: 'peel-test',
                label: 'Solar Cell Peel Strength Test',
                path: '/peel-test',
                description: 'Record solar cell peel strength results, remarks, and report history.',
                icon: Activity,
            },
            {
                id: 'wet-leakage-test',
                label: 'Wet Leakage Test',
                path: '/wet-leakage-test',
                description: 'Maintain wet leakage readings, result status, and approval workflow.',
                icon: ShieldCheck,
            },
        ],
    },
    {
        id: 'quality-analysis',
        label: 'Quality Analysis',
        path: '/quality-analysis',
        description: 'Review quality trends, inspection insights, audit observations, and analysis dashboards.',
        icon: BarChart3,
        children: [
            {
                id: 'b-grade',
                label: 'B-Grade',
                path: '/b-grade-trend',
                description: 'Analyze B-grade trends, rejection patterns, and improvement areas.',
                icon: ChartColumnIncreasing,
            },
            {
                id: 'fqc-analysis',
                label: 'FQC Analysis',
                path: '/fqc',
                description: 'Review final quality checks, observations, and line-level results.',
                icon: PackageCheck,
            },
            {
                id: 'lam-qc',
                label: 'Lam QC',
                path: '/lamqc',
                description: 'Analyze lamination quality checks and recurring process findings.',
                icon: Factory,
            },
            {
                id: 'pre-lam',
                label: 'Pre Lam',
                path: '/prelam',
                description: 'Review pre-lamination quality data and inspection trends.',
                icon: ClipboardCheck,
            },
        ],
    },
];

export function getSectionNavigation(sectionId: SectionId): NavigationSection {
    const section = sectionNavigation.find((item) => item.id === sectionId);

    if (!section) {
        throw new Error(`Unknown navigation section: ${sectionId}`);
    }

    return section;
}
