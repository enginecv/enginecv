"use client";

import {
    CalendarDays,
    Flag,
    Car,
    CreditCard,
    Heart,
    ShieldCheck,
    UserRound,
    Accessibility,
    Plane,
    Ruler,
    Globe,
    Briefcase as BriefcaseIcon,
    Code2 as CodeIcon,
    PenLine as PenIcon,
    Star as StarIcon,
    BookOpen as BookIcon,
    ChevronDown,
    Check,
    X,
    Trash2,
    Link as LinkIcon,
    LucideIcon,
    Search,
    // Extended icon set
    Home,
    Mail,
    Phone,
    MapPin,
    Camera,
    Image,
    Music,
    Video,
    Headphones,
    Mic,
    Monitor,
    Smartphone,
    Tablet,
    Laptop,
    Wifi,
    Bluetooth,
    Battery,
    Zap,
    Sun,
    Moon,
    Cloud,
    CloudRain,
    Snowflake,
    Wind,
    Thermometer,
    Droplets,
    Flame,
    Leaf,
    Trees as Tree,
    Flower2 as Flower,
    Mountain,
    Waves,
    Anchor,
    Compass,
    Navigation,
    Map,
    Trophy,
    Medal,
    Award,
    Crown,
    Diamond,
    Gem,
    Target,
    Crosshair,
    Shield,
    Lock,
    Unlock,
    Key,
    Eye,
    EyeOff,
    Bell,
    BellRing,
    MessageCircle,
    MessageSquare,
    Send,
    Inbox,
    Archive,
    Bookmark,
    Tag,
    Hash,
    AtSign,
    Percent,
    DollarSign,
    Euro,
    Coins,
    Wallet,
    ShoppingCart,
    ShoppingBag,
    Package,
    Gift,
    Box,
    Truck,
    Ship,
    Train,
    Bike,
    Rocket,
    Gauge,
    Wrench,
    Hammer,
    Scissors,
    Paintbrush,
    Palette,
    Pen,
    Pencil,
    Eraser,
    Type,
    Bold,
    Italic,
    FileText,
    File,
    Folder,
    FolderOpen,
    Database,
    HardDrive,
    Server,
    Cpu,
    MemoryStick,
    CircuitBoard,
    Terminal,
    Code,
    Braces,
    Binary,
    Bug,
    GitBranch,
    GitCommit,
    GitMerge,
    GitPullRequest,
    Github,
    Blocks,
    Puzzle,
    Gamepad2,
    Dice5,
    Joystick,
    Dumbbell,
    PersonStanding,
    Footprints,
    Bike as Bicycle,
    HeartPulse,
    Activity,
    Stethoscope,
    Pill,
    Syringe,
    TestTube2,
    Microscope,
    Atom,
    FlaskConical,
    Beaker,
    GraduationCap,
    School,
    Library,
    Landmark,
    Building2,
    Building,
    Factory,
    Store,
    Hotel,
    Hospital,
    Church,
    Castle,
    Tent,
    TreePine,
    Palmtree,
    Sunrise,
    Sunset,
    Cloudy,
    Rainbow,
    Umbrella,
    Coffee,
    Wine,
    Beer,
    UtensilsCrossed,
    ChefHat,
    CookingPot,
    Apple,
    Cherry,
    Grape,
    Banana,
    Carrot,
    Croissant,
    Pizza,
    Sandwich,
    Cake,
    IceCream2 as IceCream,
    Candy,
    Popcorn,
    Soup,
    Salad,
    Egg,
    Fish,
    Beef,
    Drumstick,
    Cat,
    Dog,
    Bird,
    Rabbit,
    Squirrel,
    Turtle,
    Snail,
    Sparkles,
    PartyPopper,
    Lightbulb,
    Lamp,
    Power,
    PlugZap,
    Cable,
    Radio,
    Tv,
    Speaker,
    Volume2,
    Play,
    Pause,
    SquareIcon,
    SkipForward,
    SkipBack,
    Repeat,
    Shuffle,
    Download,
    Upload,
    Share2,
    ExternalLink,
    QrCode,
    Scan,
    Printer,
    ScanLine,
    Fingerprint,
    Users,
    UserPlus,
    UserMinus,
    UserCheck,
    Contact,
    BadgeCheck,
    Handshake,
    ThumbsUp,
    ThumbsDown,
    SmilePlus,
    Frown,
    Meh,
    Laugh,
    Angry,
    HeartHandshake,
    BrainCircuit,
    Brain,
    Glasses,
    Shirt,
    Watch,
    Armchair,
    Bed,
    Bath,
    Sofa,
    Refrigerator,
    WashingMachine,
    Fan,
    AirVent,
    Heater,
    CircleDot,
    Hexagon,
    Triangle,
    Pentagon,
    Octagon,
    SquareAsterisk,
    Infinity,
    Pi,
    Sigma,
    Omega,
    Ratio,
    Calculator,
    BarChart3,
    LineChart,
    PieChart,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    RotateCw,
    RefreshCw,
    Timer,
    Clock,
    Hourglass,
    Calendar,
    CalendarCheck,
    CalendarClock,
    AlarmClock,
    Clipboard,
    ClipboardList,
    ClipboardCheck,
    ListChecks,
    ListTodo,
    CheckSquare,
    XSquare,
    AlertTriangle,
    AlertCircle,
    Info,
    HelpCircle,
    CircleHelp,
    Ban,
    XCircle,
    CheckCircle,
    PlusCircle,
    MinusCircle,
    Settings,
    SlidersHorizontal,
    Filter,
    Layers,
    LayoutGrid,
    LayoutList,
    Grid3x3,
    Table2,
    Kanban,
    Workflow,
    Network,
    Share,
    Unplug,
    Plug,
    Magnet,
    Paperclip,
    Pin,
    Scissors as ScissorsIcon2,
    Crop,
    Move,
    Maximize,
    Minimize,
    Expand,
    Shrink,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
    Wand2,
    CircleSlash,
    Sparkle,
    Feather,
    Origami,
    Shapes,
    Spline,
    Component,
    Figma,
    Chrome,
    Slack,
    Twitch,
    Youtube,
    Instagram,
    Facebook,
    Twitter,
    Linkedin,
    Dribbble,
} from "lucide-react";
import { useId, useState, useRef, useEffect, useMemo } from "react";
import { BRAND_ICON_CHOICES, resolveBrandValue, type IconComponent } from "@/lib/icons/brand-icons";
import { useTranslation } from "@/lib/i18n";
import { formatCvDate } from "@/lib/cv-language";

export const OPTIONAL_PERSONAL_DETAILS = [
    { id: "dateOfBirth", label: "Date of Birth", labelKey: "form.dateOfBirth" },
    { id: "nationality", label: "Nationality", labelKey: "form.nationality" },
    { id: "drivingLicense", label: "Driving License", labelKey: "form.drivingLicense" },
    { id: "passport", label: "Passport", labelKey: "form.passport" },
    { id: "nationalId", label: "National ID", labelKey: "form.nationalId" },
    { id: "maritalStatus", label: "Marital status", labelKey: "form.maritalStatus" },
    { id: "militaryService", label: "Military Service", labelKey: "form.militaryService" },
    { id: "genderPronoun", label: "Gender/Pronoun", labelKey: "form.genderPronoun" },
    { id: "disability", label: "Disability", labelKey: "form.disability" },
    { id: "visa", label: "Visa", labelKey: "form.visa" },
    { id: "height", label: "Height", labelKey: "form.height" },
] as const;

export const SOCIAL_NETWORKS = [
    "LinkedIn",
    "Portfolio Site",
    "Website",
    "GitHub",
    "GitBook", "Medium", "ORCID", "Skype", "Bluesky",
    "Threads", "X", "Discord", "Dribbble", "Behance",
    "Stack Overflow", "GitLab", "Quora", "Facebook",
    "Instagram", "WeChat", "Hugging Face", "Kaggle",
    "YouTube", "TikTok", "Signal", "Telegram", "WhatsApp"
];

// Common icons — "Auto" + section defaults from Add Content + essential basics
const COMMON_ICON_CHOICES = [
    // Section defaults (used in Add Content pages)
    { value: "graduation-cap", label: "Graduation Cap" },
    { value: "briefcase", label: "Briefcase" },
    { value: "star", label: "Star" },
    { value: "globe", label: "Globe" },
    { value: "award", label: "Award" },
    { value: "heart", label: "Heart" },
    { value: "folder-open", label: "Folder Open" },
    { value: "book", label: "Book" },
    { value: "users", label: "Users" },
    { value: "contact", label: "Contact" },
    { value: "pen", label: "Pen" },
    { value: "puzzle", label: "Puzzle" },
    // Essential basics
    { value: "user", label: "User" },
    { value: "mail", label: "Mail" },
    { value: "phone", label: "Phone" },
    { value: "home", label: "Home" },
    { value: "map-pin", label: "Map Pin" },
    { value: "link", label: "Link" },
    { value: "code", label: "Code" },
    { value: "file-text", label: "File Text" },
    { value: "trophy", label: "Trophy" },
    { value: "lightbulb", label: "Lightbulb" },
    { value: "bookmark", label: "Bookmark" },
    { value: "settings", label: "Settings" },
] as const;

// All other icons
const OTHER_ICON_CHOICES = [
    // People & Identity
    { value: "user-plus", label: "User Plus" },
    { value: "user-check", label: "User Check" },
    { value: "person-standing", label: "Person" },
    { value: "handshake", label: "Handshake" },
    { value: "heart-handshake", label: "Heart Handshake" },
    { value: "badge-check", label: "Badge Check" },
    { value: "fingerprint", label: "Fingerprint" },
    { value: "glasses", label: "Glasses" },
    // Communication
    { value: "message-circle", label: "Message Circle" },
    { value: "message-square", label: "Message Square" },
    { value: "send", label: "Send" },
    { value: "inbox", label: "Inbox" },
    { value: "at-sign", label: "At Sign" },
    { value: "bell", label: "Bell" },
    { value: "bell-ring", label: "Bell Ring" },
    // Work & Business
    { value: "building", label: "Building" },
    { value: "building-2", label: "Office Building" },
    { value: "factory", label: "Factory" },
    { value: "store", label: "Store" },
    { value: "landmark", label: "Landmark" },
    { value: "dollar-sign", label: "Dollar Sign" },
    { value: "euro", label: "Euro" },
    { value: "coins", label: "Coins" },
    { value: "wallet", label: "Wallet" },
    { value: "credit-card", label: "Credit Card" },
    { value: "shopping-cart", label: "Shopping Cart" },
    { value: "shopping-bag", label: "Shopping Bag" },
    { value: "bar-chart", label: "Bar Chart" },
    { value: "line-chart", label: "Line Chart" },
    { value: "pie-chart", label: "Pie Chart" },
    { value: "trending-up", label: "Trending Up" },
    { value: "trending-down", label: "Trending Down" },
    // Education & Knowledge
    { value: "school", label: "School" },
    { value: "library", label: "Library" },
    { value: "brain", label: "Brain" },
    { value: "brain-circuit", label: "Brain Circuit" },
    { value: "atom", label: "Atom" },
    { value: "microscope", label: "Microscope" },
    { value: "flask", label: "Flask" },
    { value: "beaker", label: "Beaker" },
    { value: "test-tube", label: "Test Tube" },
    // Technology & Development
    { value: "terminal", label: "Terminal" },
    { value: "braces", label: "Braces" },
    { value: "binary", label: "Binary" },
    { value: "bug", label: "Bug" },
    { value: "cpu", label: "CPU" },
    { value: "circuit-board", label: "Circuit Board" },
    { value: "database", label: "Database" },
    { value: "server", label: "Server" },
    { value: "hard-drive", label: "Hard Drive" },
    { value: "monitor", label: "Monitor" },
    { value: "laptop", label: "Laptop" },
    { value: "smartphone", label: "Smartphone" },
    { value: "tablet", label: "Tablet" },
    { value: "wifi", label: "WiFi" },
    { value: "git-branch", label: "Git Branch" },
    { value: "git-commit", label: "Git Commit" },
    { value: "git-merge", label: "Git Merge" },
    { value: "git-pull-request", label: "Git Pull Request" },
    { value: "github", label: "GitHub" },
    { value: "blocks", label: "Blocks" },
    { value: "component", label: "Component" },
    { value: "workflow", label: "Workflow" },
    { value: "network", label: "Network" },
    // Creative & Design
    { value: "pencil", label: "Pencil" },
    { value: "paintbrush", label: "Paintbrush" },
    { value: "palette", label: "Palette" },
    { value: "camera", label: "Camera" },
    { value: "image", label: "Image" },
    { value: "figma", label: "Figma" },
    { value: "wand", label: "Magic Wand" },
    { value: "sparkle", label: "Sparkle" },
    { value: "sparkles", label: "Sparkles" },
    { value: "feather", label: "Feather" },
    { value: "origami", label: "Origami" },
    { value: "shapes", label: "Shapes" },
    { value: "spline", label: "Spline" },
    // Media & Entertainment
    { value: "music", label: "Music" },
    { value: "video", label: "Video" },
    { value: "headphones", label: "Headphones" },
    { value: "mic", label: "Microphone" },
    { value: "play", label: "Play" },
    { value: "radio", label: "Radio" },
    { value: "tv", label: "TV" },
    { value: "speaker", label: "Speaker" },
    { value: "gamepad", label: "Gamepad" },
    { value: "dice", label: "Dice" },
    { value: "joystick", label: "Joystick" },
    // Writing & Documents
    { value: "file", label: "File" },
    { value: "folder", label: "Folder" },
    { value: "clipboard", label: "Clipboard" },
    { value: "clipboard-list", label: "Clipboard List" },
    { value: "clipboard-check", label: "Clipboard Check" },
    { value: "type", label: "Typography" },
    { value: "tag", label: "Tag" },
    { value: "hash", label: "Hash" },
    // Awards & Achievement
    { value: "medal", label: "Medal" },
    { value: "crown", label: "Crown" },
    { value: "diamond", label: "Diamond" },
    { value: "gem", label: "Gem" },
    { value: "target", label: "Target" },
    { value: "thumbs-up", label: "Thumbs Up" },
    { value: "party-popper", label: "Party Popper" },
    // Navigation & Location
    { value: "map", label: "Map" },
    { value: "compass", label: "Compass" },
    { value: "navigation", label: "Navigation" },
    { value: "external-link", label: "External Link" },
    { value: "share", label: "Share" },
    { value: "qr-code", label: "QR Code" },
    // Transport
    { value: "plane", label: "Plane" },
    { value: "car", label: "Car" },
    { value: "truck", label: "Truck" },
    { value: "ship", label: "Ship" },
    { value: "train", label: "Train" },
    { value: "bike", label: "Bike" },
    { value: "rocket", label: "Rocket" },
    // Health & Fitness
    { value: "heart-pulse", label: "Heart Pulse" },
    { value: "activity", label: "Activity" },
    { value: "dumbbell", label: "Dumbbell" },
    { value: "stethoscope", label: "Stethoscope" },
    { value: "pill", label: "Pill" },
    { value: "syringe", label: "Syringe" },
    { value: "hospital", label: "Hospital" },
    // Security
    { value: "shield", label: "Shield" },
    { value: "shield-check", label: "Shield Check" },
    { value: "lock", label: "Lock" },
    { value: "unlock", label: "Unlock" },
    { value: "key", label: "Key" },
    { value: "eye", label: "Eye" },
    { value: "eye-off", label: "Eye Off" },
    { value: "scan", label: "Scan" },
    // Nature & Weather
    { value: "sun", label: "Sun" },
    { value: "moon", label: "Moon" },
    { value: "cloud", label: "Cloud" },
    { value: "cloud-rain", label: "Cloud Rain" },
    { value: "snowflake", label: "Snowflake" },
    { value: "wind", label: "Wind" },
    { value: "rainbow", label: "Rainbow" },
    { value: "umbrella", label: "Umbrella" },
    { value: "leaf", label: "Leaf" },
    { value: "tree", label: "Tree" },
    { value: "tree-pine", label: "Pine Tree" },
    { value: "palm-tree", label: "Palm Tree" },
    { value: "flower", label: "Flower" },
    { value: "mountain", label: "Mountain" },
    { value: "waves", label: "Waves" },
    { value: "anchor", label: "Anchor" },
    { value: "flame", label: "Flame" },
    { value: "sunrise", label: "Sunrise" },
    { value: "sunset", label: "Sunset" },
    // Food & Drink
    { value: "coffee", label: "Coffee" },
    { value: "wine", label: "Wine" },
    { value: "beer", label: "Beer" },
    { value: "utensils", label: "Utensils" },
    { value: "chef-hat", label: "Chef Hat" },
    { value: "cooking-pot", label: "Cooking Pot" },
    { value: "apple", label: "Apple" },
    { value: "pizza", label: "Pizza" },
    { value: "cake", label: "Cake" },
    { value: "ice-cream", label: "Ice Cream" },
    { value: "candy", label: "Candy" },
    // Animals
    { value: "cat", label: "Cat" },
    { value: "dog", label: "Dog" },
    { value: "bird", label: "Bird" },
    { value: "rabbit", label: "Rabbit" },
    { value: "fish", label: "Fish" },
    { value: "squirrel", label: "Squirrel" },
    { value: "turtle", label: "Turtle" },
    { value: "snail", label: "Snail" },
    // Misc Tools & Objects
    { value: "wrench", label: "Wrench" },
    { value: "hammer", label: "Hammer" },
    { value: "scissors", label: "Scissors" },
    { value: "ruler", label: "Ruler" },
    { value: "gauge", label: "Gauge" },
    { value: "power", label: "Power" },
    { value: "plug", label: "Plug" },
    { value: "zap", label: "Zap" },
    { value: "magnet", label: "Magnet" },
    { value: "paperclip", label: "Paperclip" },
    { value: "pin", label: "Pin" },
    { value: "package", label: "Package" },
    { value: "gift", label: "Gift" },
    { value: "box", label: "Box" },
    { value: "printer", label: "Printer" },
    { value: "download", label: "Download" },
    { value: "upload", label: "Upload" },
    // Time & Scheduling
    { value: "clock", label: "Clock" },
    { value: "timer", label: "Timer" },
    { value: "hourglass", label: "Hourglass" },
    { value: "calendar", label: "Calendar" },
    { value: "calendar-check", label: "Calendar Check" },
    { value: "alarm-clock", label: "Alarm Clock" },
    // Math & Data
    { value: "calculator", label: "Calculator" },
    { value: "percent", label: "Percent" },
    { value: "infinity", label: "Infinity" },
    { value: "sigma", label: "Sigma" },
    // Settings & UI
    { value: "sliders", label: "Sliders" },
    { value: "filter", label: "Filter" },
    { value: "layers", label: "Layers" },
    { value: "layout-grid", label: "Layout Grid" },
    // Status & Info
    { value: "check-circle", label: "Check Circle" },
    { value: "alert-triangle", label: "Alert" },
    { value: "info", label: "Info" },
    { value: "help-circle", label: "Help" },
    { value: "ban", label: "Ban" },
    // Shapes
    { value: "circle-dot", label: "Circle Dot" },
    { value: "hexagon", label: "Hexagon" },
    { value: "triangle", label: "Triangle" },
    { value: "pentagon", label: "Pentagon" },
    { value: "octagon", label: "Octagon" },
    // Flags & Identity
    { value: "flag", label: "Flag" },
    { value: "accessibility", label: "Accessibility" },
    // Social brands
    { value: "chrome", label: "Chrome" },
    { value: "slack", label: "Slack" },
    { value: "twitch", label: "Twitch" },
    { value: "youtube", label: "YouTube" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "twitter", label: "Twitter/X" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "dribbble", label: "Dribbble" },
] as const;

// Combined flat list for backward compatibility
const CUSTOM_ICON_CHOICES = [...COMMON_ICON_CHOICES, ...OTHER_ICON_CHOICES] as const;

const PICKER_BRANDS = new Set(["github", "figma", "chrome", "slack", "twitch", "youtube", "instagram", "facebook", "twitter", "linkedin", "dribbble"]);

function localizedIconChoice(choice: { value: string; label: string }, t: (key: string) => string) {
    return PICKER_BRANDS.has(choice.value)
        ? choice
        : { ...choice, label: t(`iconPicker.name.${choice.value}`) };
}

export const CUSTOM_ICON_LUCIDE_MAP: Record<string, LucideIcon> = {
    auto: Globe,
    // People & Identity
    user: UserRound,
    users: Users,
    "user-plus": UserPlus,
    "user-check": UserCheck,
    contact: Contact,
    "person-standing": PersonStanding,
    handshake: Handshake,
    "heart-handshake": HeartHandshake,
    "badge-check": BadgeCheck,
    fingerprint: Fingerprint,
    glasses: Glasses,
    // Communication
    globe: Globe,
    mail: Mail,
    phone: Phone,
    "message-circle": MessageCircle,
    "message-square": MessageSquare,
    send: Send,
    inbox: Inbox,
    "at-sign": AtSign,
    bell: Bell,
    "bell-ring": BellRing,
    // Work & Business
    briefcase: BriefcaseIcon,
    building: Building,
    "building-2": Building2,
    factory: Factory,
    store: Store,
    landmark: Landmark,
    "dollar-sign": DollarSign,
    euro: Euro,
    coins: Coins,
    wallet: Wallet,
    "credit-card": CreditCard,
    "shopping-cart": ShoppingCart,
    "shopping-bag": ShoppingBag,
    "bar-chart": BarChart3,
    "line-chart": LineChart,
    "pie-chart": PieChart,
    "trending-up": TrendingUp,
    "trending-down": TrendingDown,
    // Education & Knowledge
    "graduation-cap": GraduationCap,
    school: School,
    library: Library,
    book: BookIcon,
    lightbulb: Lightbulb,
    brain: Brain,
    "brain-circuit": BrainCircuit,
    atom: Atom,
    microscope: Microscope,
    flask: FlaskConical,
    beaker: Beaker,
    "test-tube": TestTube2,
    // Technology & Development
    code: CodeIcon,
    terminal: Terminal,
    braces: Braces,
    binary: Binary,
    bug: Bug,
    cpu: Cpu,
    "circuit-board": CircuitBoard,
    database: Database,
    server: Server,
    "hard-drive": HardDrive,
    monitor: Monitor,
    laptop: Laptop,
    smartphone: Smartphone,
    tablet: Tablet,
    wifi: Wifi,
    "git-branch": GitBranch,
    "git-commit": GitCommit,
    "git-merge": GitMerge,
    "git-pull-request": GitPullRequest,
    github: Github,
    blocks: Blocks,
    puzzle: Puzzle,
    component: Component,
    workflow: Workflow,
    network: Network,
    // Creative & Design
    pen: PenIcon,
    pencil: Pencil,
    paintbrush: Paintbrush,
    palette: Palette,
    camera: Camera,
    image: Image,
    figma: Figma,
    wand: Wand2,
    sparkle: Sparkle,
    sparkles: Sparkles,
    feather: Feather,
    origami: Origami,
    shapes: Shapes,
    spline: Spline,
    // Media & Entertainment
    music: Music,
    video: Video,
    headphones: Headphones,
    mic: Mic,
    play: Play,
    radio: Radio,
    tv: Tv,
    speaker: Speaker,
    gamepad: Gamepad2,
    dice: Dice5,
    joystick: Joystick,
    // Writing & Documents
    "file-text": FileText,
    file: File,
    folder: Folder,
    "folder-open": FolderOpen,
    clipboard: Clipboard,
    "clipboard-list": ClipboardList,
    "clipboard-check": ClipboardCheck,
    type: Type,
    bookmark: Bookmark,
    tag: Tag,
    hash: Hash,
    // Awards & Achievement
    star: StarIcon,
    heart: Heart,
    trophy: Trophy,
    medal: Medal,
    award: Award,
    crown: Crown,
    diamond: Diamond,
    gem: Gem,
    target: Target,
    "thumbs-up": ThumbsUp,
    "party-popper": PartyPopper,
    // Navigation & Location
    home: Home,
    "map-pin": MapPin,
    map: Map,
    compass: Compass,
    navigation: Navigation,
    link: LinkIcon,
    "external-link": ExternalLink,
    share: Share2,
    "qr-code": QrCode,
    // Transport
    plane: Plane,
    car: Car,
    truck: Truck,
    ship: Ship,
    train: Train,
    bike: Bike,
    rocket: Rocket,
    // Health & Fitness
    "heart-pulse": HeartPulse,
    activity: Activity,
    dumbbell: Dumbbell,
    stethoscope: Stethoscope,
    pill: Pill,
    syringe: Syringe,
    hospital: Hospital,
    // Security
    shield: Shield,
    "shield-check": ShieldCheck,
    lock: Lock,
    unlock: Unlock,
    key: Key,
    eye: Eye,
    "eye-off": EyeOff,
    scan: Scan,
    // Nature & Weather
    sun: Sun,
    moon: Moon,
    cloud: Cloud,
    "cloud-rain": CloudRain,
    snowflake: Snowflake,
    wind: Wind,
    rainbow: Rainbow,
    umbrella: Umbrella,
    leaf: Leaf,
    tree: Tree,
    "tree-pine": TreePine,
    "palm-tree": Palmtree,
    flower: Flower,
    mountain: Mountain,
    waves: Waves,
    anchor: Anchor,
    flame: Flame,
    sunrise: Sunrise,
    sunset: Sunset,
    // Food & Drink
    coffee: Coffee,
    wine: Wine,
    beer: Beer,
    utensils: UtensilsCrossed,
    "chef-hat": ChefHat,
    "cooking-pot": CookingPot,
    apple: Apple,
    pizza: Pizza,
    cake: Cake,
    "ice-cream": IceCream,
    candy: Candy,
    // Animals
    cat: Cat,
    dog: Dog,
    bird: Bird,
    rabbit: Rabbit,
    fish: Fish,
    squirrel: Squirrel,
    turtle: Turtle,
    snail: Snail,
    // Misc Tools & Objects
    wrench: Wrench,
    hammer: Hammer,
    scissors: Scissors,
    ruler: Ruler,
    gauge: Gauge,
    power: Power,
    plug: Plug,
    zap: Zap,
    magnet: Magnet,
    paperclip: Paperclip,
    pin: Pin,
    package: Package,
    gift: Gift,
    box: Box,
    printer: Printer,
    download: Download,
    upload: Upload,
    // Time & Scheduling
    clock: Clock,
    timer: Timer,
    hourglass: Hourglass,
    calendar: Calendar,
    "calendar-check": CalendarCheck,
    "alarm-clock": AlarmClock,
    // Math & Data
    calculator: Calculator,
    percent: Percent,
    infinity: Infinity,
    sigma: Sigma,
    // Settings & UI
    settings: Settings,
    sliders: SlidersHorizontal,
    filter: Filter,
    layers: Layers,
    "layout-grid": LayoutGrid,
    // Status & Info
    "check-circle": CheckCircle,
    "alert-triangle": AlertTriangle,
    info: Info,
    "help-circle": CircleHelp,
    ban: Ban,
    // Shapes
    "circle-dot": CircleDot,
    hexagon: Hexagon,
    triangle: Triangle,
    pentagon: Pentagon,
    octagon: Octagon,
    // Flags & Identity
    flag: Flag,
    accessibility: Accessibility,
    // Social brands
    chrome: Chrome,
    slack: Slack,
    twitch: Twitch,
    youtube: Youtube,
    instagram: Instagram,
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    dribbble: Dribbble,
};

export const PERSONAL_DETAIL_ICON_MAP: Record<string, LucideIcon> = {
    dateOfBirth: CalendarDays,
    nationality: Flag,
    drivingLicense: Car,
    passportOrId: CreditCard,
    passport: CreditCard,
    nationalId: CreditCard,
    maritalStatus: Heart,
    militaryService: ShieldCheck,
    genderPronoun: UserRound,
    disability: Accessibility,
    visa: Plane,
    height: Ruler,
};

export const SOCIAL_BRAND_SLUG_MAP: Record<string, string> = {
    LinkedIn: "linkedin",
    GitHub: "github",
    GitBook: "gitbook",
    Medium: "medium",
    ORCID: "orcid",
    Skype: "skype",
    Bluesky: "bluesky",
    Threads: "threads",
    X: "x",
    Discord: "discord",
    Dribbble: "dribbble",
    Behance: "behance",
    "Stack Overflow": "stackoverflow",
    GitLab: "gitlab",
    Quora: "quora",
    Facebook: "facebook",
    Instagram: "instagram",
    WeChat: "wechat",
    "Hugging Face": "huggingface",
    Kaggle: "kaggle",
    YouTube: "youtube",
    TikTok: "tiktok",
    Signal: "signal",
    Telegram: "telegram",
    WhatsApp: "whatsapp",
};

export function SocialBrandIcon({ name, className }: { name: string; className: string }) {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    const slug = SOCIAL_BRAND_SLUG_MAP[name];

    if (!slug || failed) {
        return <Globe className={className} />;
    }

    return (
        <img
            src={`https://cdn.simpleicons.org/${slug}/E8E8EA`}
            alt={t("icon.logo", { name })}
            className={className}
            onError={() => setFailed(true)}
        />
    );
}

// Resolve a picker choice value to its component. Handles lucide keys and
// `brand:<slug>` tech logos alike.
function resolvePickerIcon(value: string): IconComponent {
    const brand = resolveBrandValue(value);
    if (brand) return brand.Comp;
    return CUSTOM_ICON_LUCIDE_MAP[value] || Globe;
}

export function CustomIconSelect({
    linkName,
    value,
    onChange,
    noneLabel,
}: {
    linkName: string;
    value: string;
    onChange: (value: string) => void;
    /** Replaces the "auto" choice with an explicit "no icon" choice whose value is "". */
    noneLabel?: string;
}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const leadValue = noneLabel !== undefined ? "" : "auto";
    const leadLabel = noneLabel ?? t("iconPicker.auto");
    const LeadIcon = noneLabel !== undefined ? CircleSlash : Wand2;
    const allChoices = [{ value: leadValue, label: leadLabel }, ...CUSTOM_ICON_CHOICES.map((choice) => localizedIconChoice(choice, t)), ...BRAND_ICON_CHOICES];
    const selected = allChoices.find(c => c.value === value) || allChoices[0];

    const isSearching = searchQuery.trim().length > 0;
    const q = searchQuery.toLowerCase();

    const filteredCommon = useMemo(() => {
        const choices = COMMON_ICON_CHOICES.map((choice) => localizedIconChoice(choice, t));
        if (!isSearching) return choices;
        return choices.filter(c =>
            c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
        );
    }, [isSearching, q, t]);

    const filteredOther = useMemo(() => {
        const choices = OTHER_ICON_CHOICES.map((choice) => localizedIconChoice(choice, t));
        if (!isSearching) return choices;
        return choices.filter(c =>
            c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
        );
    }, [isSearching, q, t]);

    const filteredBrands = useMemo(() => {
        if (!isSearching) return BRAND_ICON_CHOICES;
        return BRAND_ICON_CHOICES.filter(c =>
            c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
        );
    }, [isSearching, q]);

    const hasResults = filteredCommon.length > 0 || filteredOther.length > 0 || filteredBrands.length > 0;

    const renderIconButton = (choice: { value: string; label: string }) => {
        const active = value === choice.value;
        const IconComponent = resolvePickerIcon(choice.value);
        return (
            <button
                key={choice.value}
                type="button"
                title={choice.label}
                onClick={() => { onChange(choice.value); setIsOpen(false); setSearchQuery(""); }}
                className={`relative w-full aspect-square rounded-lg flex items-center justify-center transition-colors ${
                    active
                        ? 'bg-accent/15 border border-accent/40 text-accent'
                        : 'hover:bg-edge text-dim hover:text-strong border border-transparent'
                }`}
            >
                <IconComponent className="w-4 h-4 shrink-0" />
                {active && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full flex items-center justify-center">
                        <Check className="w-1.5 h-1.5 text-surface-1" />
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearchQuery(""); }}
                className="touch-manipulation w-full bg-surface-1 border border-edge rounded-xl px-3 py-2 text-sm text-strong focus:outline-none focus:border-faint transition-colors flex items-center justify-between"
            >
                <span className="truncate pr-2 flex items-center gap-2">
                    {selected.value === leadValue ? (
                        <LeadIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                    ) : (
                        (() => {
                            const SelectedIcon = resolvePickerIcon(selected.value);
                            return <SelectedIcon className="w-3.5 h-3.5 text-bright shrink-0" />;
                        })()
                    )}
                    {selected.label}
                </span>
                <ChevronDown className="w-4 h-4 text-faint shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full right-auto z-50 mt-2 w-full max-w-[320px] bg-surface-4 border border-edge rounded-xl shadow-xl overflow-hidden sm:w-[320px]">
                    {/* Search bar */}
                    <div className="p-2 border-b border-edge">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t("iconPicker.search")}
                                className="w-full bg-surface-1 border border-edge rounded-lg py-1.5 pl-8 pr-3 text-xs text-strong focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50"
                            />
                        </div>
                    </div>
                    {/* Icon grid with sections */}
                    <div className="max-h-[320px] overflow-y-auto p-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-edge [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        {/* Auto button */}
                        {(!isSearching || leadLabel.toLowerCase().includes(q)) && (
                            <button
                                type="button"
                                onClick={() => { onChange(leadValue); setIsOpen(false); setSearchQuery(""); }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium mb-2 transition-colors ${
                                    value === leadValue
                                        ? 'bg-accent/15 border border-accent/40 text-accent'
                                        : 'hover:bg-edge text-dim hover:text-strong border border-transparent'
                                }`}
                            >
                                <LeadIcon className="w-4 h-4 shrink-0" />
                                {leadLabel}
                                {value === leadValue && <Check className="w-3 h-3 ml-auto text-accent" />}
                            </button>
                        )}
                        {!hasResults && !(isSearching && leadLabel.toLowerCase().includes(q)) ? (
                            <div className="text-center text-xs text-faint py-6">{t("iconPicker.noResults")}</div>
                        ) : (
                            <>
                                {filteredCommon.length > 0 && (
                                    <div className="mb-2">
                                        <div className="text-[10px] font-medium text-faint uppercase tracking-wider px-1 mb-1.5">{t("iconPicker.common")}</div>
                                        <div className="grid grid-cols-6 gap-1">
                                            {filteredCommon.map(renderIconButton)}
                                        </div>
                                    </div>
                                )}
                                {filteredOther.length > 0 && (
                                    <div>
                                        {filteredCommon.length > 0 && (
                                            <div className="border-t border-edge my-2" />
                                        )}
                                        <div className="text-[10px] font-medium text-faint uppercase tracking-wider px-1 mb-1.5">{t("iconPicker.others")}</div>
                                        <div className="grid grid-cols-6 gap-1">
                                            {filteredOther.map(renderIconButton)}
                                        </div>
                                    </div>
                                )}
                                {filteredBrands.length > 0 && (
                                    <div>
                                        {(filteredCommon.length > 0 || filteredOther.length > 0) && (
                                            <div className="border-t border-edge my-2" />
                                        )}
                                        <div className="text-[10px] font-medium text-faint uppercase tracking-wider px-1 mb-1.5">{t("iconPicker.brands")}</div>
                                        <div className="grid grid-cols-6 gap-1">
                                            {filteredBrands.map(renderIconButton)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function Input({ label, value, onChange, placeholder, type = "text", icon: Icon, id, ...inputProps }: any) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
    <div className="space-y-2">
        {label && <label htmlFor={inputId} className="text-[11px] font-medium text-faint uppercase tracking-wider">{label}</label>}
        <div className="relative">
            <input
                id={inputId}
                type={type}
                value={value}
                onChange={onChange}
                className={`w-full bg-surface-1 border border-edge rounded-xl py-2.5 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong ${Icon ? 'pl-4 pr-10' : 'px-4'}`}
                placeholder={placeholder}
                {...inputProps}
            />
            {Icon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-faint">
                    <Icon className="w-4 h-4" />
                </div>
            )}
        </div>
    </div>
    );
}

export function AutocompleteInput({
    label,
    value,
    onChange,
    placeholder,
    suggestions,
    icon: Icon,
    ...inputProps
}: {
    label?: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    suggestions: string[];
    icon?: LucideIcon;
    [key: string]: unknown;
}) {
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputId = useId();

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        if (!value.trim()) return suggestions;
        const q = value.toLowerCase();
        return suggestions.filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
    }, [value, suggestions]);

    const showDropdown = isFocused && filtered.length > 0;

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            {label && <label htmlFor={inputId} className="text-[11px] font-medium text-faint uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <input
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    className={`w-full bg-surface-1 border border-edge rounded-xl py-2.5 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong ${Icon ? 'pl-4 pr-10' : 'px-4'}`}
                    placeholder={placeholder}
                    {...inputProps}
                />
                {Icon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-faint">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
            </div>
            {showDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-4 border border-edge rounded-xl shadow-xl overflow-hidden py-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-edge [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    {filtered.map((suggestion) => (
                        <button
                            key={suggestion}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onChange(suggestion); setIsFocused(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge transition-colors flex items-center gap-2"
                        >
                            <MapPin className="w-3 h-3 text-faint shrink-0" />
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TagsInput({
    label,
    value,
    onChange,
    placeholder,
    icon: Icon,
}: {
    label?: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    icon?: LucideIcon;
}) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();

    const tags = useMemo(() =>
        value ? value.split(",").map(t => t.trim()).filter(Boolean) : [],
    [value]);

    const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
        const next = [...tags, trimmed].join(", ");
        onChange(next);
        setInputValue("");
    };

    const removeTag = (index: number) => {
        const next = tags.filter((_, i) => i !== index).join(", ");
        onChange(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(inputValue);
        }
        if (e.key === "Backspace" && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    return (
        <div className="space-y-2">
            {label && <label htmlFor={inputId} className="text-[11px] font-medium text-faint uppercase tracking-wider">{label}</label>}
            <div
                className="flex flex-wrap items-center gap-1.5 bg-surface-1 border border-edge rounded-xl px-3 py-2 focus-within:border-faint transition-colors min-h-[42px] cursor-text"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map((tag, index) => (
                    <span
                        key={`${tag}-${index}`}
                        className="flex items-center gap-1 bg-edge text-strong text-xs font-medium px-2.5 py-1 rounded-lg"
                    >
                        {tag}
                        <button
                            type="button"
                            aria-label={`${t("editor.remove")} ${tag}`}
                            onClick={(e) => { e.stopPropagation(); removeTag(index); }}
                            className="text-faint hover:text-danger transition-colors ml-0.5"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                    <input
                        id={inputId}
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
                        className="flex-1 bg-transparent text-sm text-strong focus:outline-none placeholder:text-faint/50 min-w-0"
                        placeholder={tags.length === 0 ? placeholder : t("form.addMore")}
                    />
                    {Icon && tags.length === 0 && !inputValue && (
                        <Icon className="w-4 h-4 text-faint shrink-0" />
                    )}
                </div>
            </div>
        </div>
    );
}

export function formatDateForDisplay(value: string, dateFormat = "DD/MM/YYYY", language = "en"): string {
    return formatCvDate(value, dateFormat, language);
}

export function LinkInput({
    label: fieldLabel,
    url,
    displayLabel,
    onUrlChange,
    onLabelChange,
    iconValue,
    onIconChange,
    placeholder,
    onRemove,
    subtitleSuggestions,
    displayLabelInputProps,
    urlInputProps,
}: {
    label: string;
    url: string;
    displayLabel?: string;
    onUrlChange: (val: string) => void;
    onLabelChange?: (val: string) => void;
    iconValue?: string;
    onIconChange?: (val: string) => void;
    placeholder: string;
    onRemove?: () => void;
    subtitleSuggestions?: string[];
    displayLabelInputProps?: Record<string, unknown>;
    urlInputProps?: Record<string, unknown>;
}) {
    const { t } = useTranslation();
    const [subtitleFocused, setSubtitleFocused] = useState(false);
    const subtitleContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (subtitleContainerRef.current && !subtitleContainerRef.current.contains(event.target as Node)) {
                setSubtitleFocused(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    const filteredSubtitleSuggestions = useMemo(() => {
        if (!subtitleSuggestions || !subtitleFocused) return [];
        const q = (displayLabel || "").toLowerCase();
        if (!q) return subtitleSuggestions;
        return subtitleSuggestions.filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
    }, [subtitleSuggestions, subtitleFocused, displayLabel]);

    return (
        <div className="relative group space-y-2">
            <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{fieldLabel}</label>
            <div className="space-y-1.5">
                {onLabelChange !== undefined && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        <div className="relative" ref={subtitleContainerRef}>
                            <input
                                type="text"
                                value={displayLabel || ""}
                                onChange={(e) => onLabelChange(e.target.value)}
                                onFocus={() => setSubtitleFocused(true)}
                                className="w-full bg-surface-1 border border-edge rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong"
                                placeholder={t("form.displayTextOptional")}
                                {...displayLabelInputProps}
                            />
                            {filteredSubtitleSuggestions.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-4 border border-edge rounded-xl shadow-xl overflow-hidden py-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-edge [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                    {filteredSubtitleSuggestions.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => { onLabelChange(s); setSubtitleFocused(false); }}
                                            className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {onIconChange && (
                            <CustomIconSelect
                                linkName={fieldLabel}
                                value={iconValue || "auto"}
                                onChange={onIconChange}
                            />
                        )}
                    </div>
                )}
                <div className="relative">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => onUrlChange(e.target.value)}
                        className="w-full bg-surface-1 border border-edge rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong"
                        placeholder={placeholder}
                        {...urlInputProps}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-faint">
                        <LinkIcon className="w-4 h-4" />
                    </div>
                </div>
            </div>
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="absolute right-0 top-0 text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
