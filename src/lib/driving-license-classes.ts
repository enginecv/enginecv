export type LicenseClass = { code: string; description: string; descriptionKey: string };

const EU_CLASSES: LicenseClass[] = [
    { code: "AM", description: "Mopeds, light quadricycles", descriptionKey: "licenseClass.EU.AM" },
    { code: "A1", description: "Light motorcycles up to 125cc", descriptionKey: "licenseClass.EU.A1" },
    { code: "A2", description: "Motorcycles up to 35 kW", descriptionKey: "licenseClass.EU.A2" },
    { code: "A", description: "Motorcycles, any size", descriptionKey: "licenseClass.EU.A" },
    { code: "B1", description: "Heavy quadricycles", descriptionKey: "licenseClass.EU.B1" },
    { code: "B", description: "Cars up to 3,500 kg", descriptionKey: "licenseClass.EU.B" },
    { code: "BE", description: "Car + trailer over 750 kg", descriptionKey: "licenseClass.EU.BE" },
    { code: "C1", description: "Medium trucks 3.5–7.5 t", descriptionKey: "licenseClass.EU.C1" },
    { code: "C1E", description: "Medium trucks + trailer", descriptionKey: "licenseClass.EU.C1E" },
    { code: "C", description: "Trucks over 3.5 t", descriptionKey: "licenseClass.EU.C" },
    { code: "CE", description: "Trucks + heavy trailer", descriptionKey: "licenseClass.EU.CE" },
    { code: "D1", description: "Minibuses up to 16 passengers", descriptionKey: "licenseClass.EU.D1" },
    { code: "D1E", description: "Minibuses + trailer", descriptionKey: "licenseClass.EU.D1E" },
    { code: "D", description: "Buses, any size", descriptionKey: "licenseClass.EU.D" },
    { code: "DE", description: "Buses + trailer", descriptionKey: "licenseClass.EU.DE" },
    { code: "T", description: "Tractors, agricultural vehicles", descriptionKey: "licenseClass.EU.T" },
];

const US_CLASSES: LicenseClass[] = [
    { code: "Class A CDL", description: "Combination vehicles over 26,001 lb", descriptionKey: "licenseClass.US.Class-A-CDL" },
    { code: "Class B CDL", description: "Single vehicles over 26,001 lb", descriptionKey: "licenseClass.US.Class-B-CDL" },
    { code: "Class C CDL", description: "Hazmat/passenger commercial", descriptionKey: "licenseClass.US.Class-C-CDL" },
    { code: "Class D", description: "Standard passenger vehicle", descriptionKey: "licenseClass.US.Class-D" },
    { code: "Class M", description: "Motorcycle", descriptionKey: "licenseClass.US.Class-M" },
    { code: "Endorsement H", description: "Hazardous materials", descriptionKey: "licenseClass.US.Endorsement-H" },
    { code: "Endorsement N", description: "Tank vehicles", descriptionKey: "licenseClass.US.Endorsement-N" },
    { code: "Endorsement P", description: "Passenger transport", descriptionKey: "licenseClass.US.Endorsement-P" },
    { code: "Endorsement S", description: "School bus", descriptionKey: "licenseClass.US.Endorsement-S" },
    { code: "Endorsement T", description: "Double/triple trailers", descriptionKey: "licenseClass.US.Endorsement-T" },
    { code: "Endorsement X", description: "Hazmat + tank combo", descriptionKey: "licenseClass.US.Endorsement-X" },
];

const UK_CLASSES: LicenseClass[] = [
    ...EU_CLASSES,
    { code: "F", description: "Agricultural tractor (UK)", descriptionKey: "licenseClass.UK.F" },
    { code: "G", description: "Road roller (UK)", descriptionKey: "licenseClass.UK.G" },
    { code: "H", description: "Tracked vehicle (UK)", descriptionKey: "licenseClass.UK.H" },
    { code: "K", description: "Mowing machine (UK)", descriptionKey: "licenseClass.UK.K" },
];

const CA_CLASSES: LicenseClass[] = [
    { code: "G1", description: "Learner (Ontario equivalent)", descriptionKey: "licenseClass.CA.G1" },
    { code: "G2", description: "Intermediate", descriptionKey: "licenseClass.CA.G2" },
    { code: "G", description: "Full passenger", descriptionKey: "licenseClass.CA.G" },
    { code: "M", description: "Motorcycle", descriptionKey: "licenseClass.CA.M" },
    { code: "Class 1", description: "Semi-trailer trucks", descriptionKey: "licenseClass.CA.Class-1" },
    { code: "Class 2", description: "Buses", descriptionKey: "licenseClass.CA.Class-2" },
    { code: "Class 3", description: "Heavy trucks", descriptionKey: "licenseClass.CA.Class-3" },
    { code: "Class 4", description: "Taxi, ambulance, small bus", descriptionKey: "licenseClass.CA.Class-4" },
    { code: "Class 5", description: "Standard passenger", descriptionKey: "licenseClass.CA.Class-5" },
];

const AU_CLASSES: LicenseClass[] = [
    { code: "C", description: "Car up to 4.5 t", descriptionKey: "licenseClass.AU.C" },
    { code: "LR", description: "Light rigid up to 8 t", descriptionKey: "licenseClass.AU.LR" },
    { code: "MR", description: "Medium rigid", descriptionKey: "licenseClass.AU.MR" },
    { code: "HR", description: "Heavy rigid", descriptionKey: "licenseClass.AU.HR" },
    { code: "HC", description: "Heavy combination", descriptionKey: "licenseClass.AU.HC" },
    { code: "MC", description: "Multi-combination", descriptionKey: "licenseClass.AU.MC" },
    { code: "R", description: "Motorcycle", descriptionKey: "licenseClass.AU.R" },
    { code: "RE", description: "Motorcycle (restricted)", descriptionKey: "licenseClass.AU.RE" },
];

const EU_MEMBER_CCA2 = new Set([
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
    "IS","LI","NO","CH","BA","RS","ME","MK","AL","XK","UA","MD",
]);

export function getLicenseClasses(cca2: string): LicenseClass[] {
    if (!cca2) return EU_CLASSES;
    if (cca2 === "US") return US_CLASSES;
    if (cca2 === "GB" || cca2 === "UK") return UK_CLASSES;
    if (cca2 === "CA") return CA_CLASSES;
    if (cca2 === "AU" || cca2 === "NZ") return AU_CLASSES;
    if (EU_MEMBER_CCA2.has(cca2)) return EU_CLASSES;
    return EU_CLASSES;
}

export type LicenseEntry = { country: string; classes: string[] };

export function parseLicenses(value: string): LicenseEntry[] {
    if (!value.trim()) return [];
    const looksStructured = /:\s*[^;]/.test(value);
    if (!looksStructured) {
        return [{ country: "", classes: value.split(",").map((s) => s.trim()).filter(Boolean) }];
    }
    return value
        .split(";")
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            const colon = block.indexOf(":");
            if (colon === -1) return { country: "", classes: [block.trim()].filter(Boolean) };
            const country = block.slice(0, colon).trim();
            const classes = block
                .slice(colon + 1)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            return { country, classes };
        })
        .filter((e) => e.country || e.classes.length > 0);
}

export function serializeLicenses(entries: LicenseEntry[]): string {
    return entries
        .filter((e) => e.country || e.classes.length > 0)
        .map((e) =>
            e.country
                ? `${e.country}: ${e.classes.join(", ")}`
                : e.classes.join(", ")
        )
        .join("; ");
}
