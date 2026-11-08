import { zlibSync } from "fflate";

/**
 * Synthetic Europass files. Element layout follows real exports of the current
 * Europass platform (Candidate) and the legacy v3.4 schema (SkillsPassport);
 * all personal data is invented.
 */

function escapeXml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const PHOTO_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

const EXPERIENCE_HTML =
    '<p>Led the <strong>payments</strong> platform team.</p>' +
    '<ol><li data-list="bullet"><span class="ql-ui"></span>Cut checkout latency by 40%</li>' +
    '<li data-list="bullet" class="ql-indent-1"><span class="ql-ui"></span>Stack: Go, PostgreSQL</li></ol>';

export function candidateXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Candidate xsi:schemaLocation="http://www.europass.eu/1.0 Candidate.xsd" xmlns="http://www.europass.eu/1.0" xmlns:oa="http://www.openapplications.org/oagis/9" xmlns:eures="http://www.europass_eures.eu/1.0" xmlns:hr="http://www.hr-xml.org/3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <hr:DocumentID schemeID="Test-0001" schemeName="DocumentIdentifier" schemeAgencyName="EUROPASS" schemeVersionID="4.0"/>
    <CandidatePerson>
        <PersonName>
            <oa:GivenName>Amina</oa:GivenName>
            <hr:FamilyName>Kovačević</hr:FamilyName>
        </PersonName>
        <Communication>
            <ChannelCode>Email</ChannelCode>
            <oa:URI>amina@example.com</oa:URI>
        </Communication>
        <Communication>
            <ChannelCode>Email</ChannelCode>
            <oa:URI>not-an-email</oa:URI>
        </Communication>
        <Communication>
            <ChannelCode>MobileTelephone</ChannelCode>
            <UseCode>personal</UseCode>
            <CountryDialing>387</CountryDialing>
            <oa:DialNumber>61123456</oa:DialNumber>
        </Communication>
        <Communication>
            <Address type="home">
                <oa:CityName>Sarajevo</oa:CityName>
                <CountryCode>ba</CountryCode>
            </Address>
        </Communication>
        <Communication>
            <ChannelCode>Web</ChannelCode>
            <UseCode>linkedin</UseCode>
            <oa:URI>https://www.linkedin.com/in/amina-example</oa:URI>
        </Communication>
        <Communication>
            <ChannelCode>Web</ChannelCode>
            <UseCode>personal</UseCode>
            <oa:URI>amina.github.io</oa:URI>
        </Communication>
        <Communication>
            <ChannelCode>Web</ChannelCode>
            <UseCode>github</UseCode>
            <oa:URI>https://github.com/amina-example</oa:URI>
        </Communication>
        <Communication>
            <ChannelCode>Web</ChannelCode>
            <UseCode>other</UseCode>
            <OtherTitle>Portfolio</OtherTitle>
            <oa:URI>https://portfolio.example.com</oa:URI>
        </Communication>
        <NationalityCode>ba</NationalityCode>
        <hr:BirthDate>1992-04-12</hr:BirthDate>
        <GenderCode>female</GenderCode>
        <PrimaryLanguageCode name="NORMAL">bos</PrimaryLanguageCode>
    </CandidatePerson>
    <CandidateProfile languageCode="en">
        <ExecutiveSummary>${escapeXml("<p>Backend engineer with <em>ten years</em> of experience.</p>")}</ExecutiveSummary>
        <EmploymentHistory>
            <EmployerHistory>
                <hr:OrganizationName>Balkan Payments</hr:OrganizationName>
                <OrganizationContact>
                    <Communication>
                        <Address>
                            <oa:CityName>Mostar</oa:CityName>
                            <CountryCode>ba</CountryCode>
                        </Address>
                    </Communication>
                </OrganizationContact>
                <PositionHistory>
                    <PositionTitle typeCode="FREETEXT">Engineering Lead</PositionTitle>
                    <eures:EmploymentPeriod>
                        <eures:StartDate><hr:FormattedDateTime>2021-03-15</hr:FormattedDateTime></eures:StartDate>
                        <hr:CurrentIndicator>true</hr:CurrentIndicator>
                    </eures:EmploymentPeriod>
                    <oa:Description>${escapeXml(EXPERIENCE_HTML)}</oa:Description>
                    <City>Sarajevo</City>
                    <Country>ba</Country>
                </PositionHistory>
                <PositionHistory>
                    <PositionTitle typeCode="FREETEXT">Backend Developer</PositionTitle>
                    <eures:EmploymentPeriod>
                        <eures:StartDate><hr:FormattedDateTime>2017</hr:FormattedDateTime></eures:StartDate>
                        <eures:EndDate><hr:FormattedDateTime>2021-02</hr:FormattedDateTime></eures:EndDate>
                        <hr:CurrentIndicator>false</hr:CurrentIndicator>
                    </eures:EmploymentPeriod>
                </PositionHistory>
                <Link>https://payments.example.com</Link>
            </EmployerHistory>
        </EmploymentHistory>
        <EducationHistory>
            <EducationOrganizationAttendance>
                <hr:OrganizationName>University of Sarajevo</hr:OrganizationName>
                <OrganizationContact>
                    <Communication>
                        <Address>
                            <oa:CityName>Sarajevo</oa:CityName>
                            <CountryCode>ba</CountryCode>
                        </Address>
                    </Communication>
                    <Communication>
                        <ChannelCode>Web</ChannelCode>
                        <oa:URI>www.unsa.example</oa:URI>
                    </Communication>
                </OrganizationContact>
                <EducationLevelCode>7</EducationLevelCode>
                <AttendancePeriod>
                    <StartDate><hr:FormattedDateTime>2012-10</hr:FormattedDateTime></StartDate>
                    <EndDate><hr:FormattedDateTime>2015-07-01</hr:FormattedDateTime></EndDate>
                    <Ongoing>false</Ongoing>
                </AttendancePeriod>
                <EducationDegree>
                    <hr:DegreeName>MSc Computer Science</hr:DegreeName>
                    <OccupationalSkillsCovered>${escapeXml("<p>Distributed systems</p>")}</OccupationalSkillsCovered>
                    <FinalGrade><hr:ScoreText>9.4</hr:ScoreText></FinalGrade>
                    <Thesis>Consensus under partitions</Thesis>
                </EducationDegree>
            </EducationOrganizationAttendance>
        </EducationHistory>
        <eures:Licenses>
            <eures:License><hr:LicenseTypeCode>B</hr:LicenseTypeCode></eures:License>
            <eures:License><hr:LicenseTypeCode>A1</hr:LicenseTypeCode></eures:License>
        </eures:Licenses>
        <Certifications>
            <Certification>
                <hr:CertificationName>AWS Solutions Architect</hr:CertificationName>
                <hr:IssuingAuthority><hr:Name>Amazon Web Services</hr:Name></hr:IssuingAuthority>
                <hr:FirstIssuedDate><hr:FormattedDateTime>2022-05-20</hr:FormattedDateTime></hr:FirstIssuedDate>
                <oa:Description>${escapeXml("<p>Professional level</p>")}</oa:Description>
                <Link>https://aws.example.com/cert/123</Link>
            </Certification>
        </Certifications>
        <PublicationHistory>
            <Publication>
                <Title>Idempotent payment APIs</Title>
                <Year>2023</Year>
                <Reference>Engineering Journal</Reference>
                <Link>https://journal.example.com/idempotency</Link>
            </Publication>
        </PublicationHistory>
        <PersonQualifications>
            <PersonCompetency>
                <CompetencyID schemeName="NORMAL">eng</CompetencyID>
                <hr:TaxonomyID>language</hr:TaxonomyID>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Understanding-Listening</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>C2</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Understanding-Reading</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>C2</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Speaking-Interaction</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>C1</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Speaking-Production</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>C1</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Writing-Production</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>B2</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
            </PersonCompetency>
            <PersonCompetency>
                <CompetencyID schemeName="FREE_TEXT">Ladino</CompetencyID>
                <hr:TaxonomyID>language</hr:TaxonomyID>
                <eures:CompetencyDimension>
                    <hr:CompetencyDimensionTypeCode>CEF-Understanding-Listening</hr:CompetencyDimensionTypeCode>
                    <eures:Score><hr:ScoreText>A2</hr:ScoreText></eures:Score>
                </eures:CompetencyDimension>
            </PersonCompetency>
        </PersonQualifications>
        <EmploymentReferences>
            <Referee>
                <PersonName>
                    <oa:GivenName>Emir</oa:GivenName>
                    <hr:FamilyName>Hodžić</hr:FamilyName>
                </PersonName>
                <Communication>
                    <ChannelCode>Email</ChannelCode>
                    <oa:URI>emir@example.com</oa:URI>
                </Communication>
                <Role>CTO</Role>
                <Comment>Direct manager 2021–2024</Comment>
            </Referee>
        </EmploymentReferences>
        <Attachment>
            <EmbeddedData>${btoa(PHOTO_DATA_URL)}</EmbeddedData>
            <FileType>photo</FileType>
            <Instructions>ProfilePicture</Instructions>
        </Attachment>
        <Projects>
            <Project>
                <Title>Open banking gateway</Title>
                <Date>
                    <StartDate><hr:FormattedDateTime>2020-01</hr:FormattedDateTime></StartDate>
                    <Ongoing>true</Ongoing>
                </Date>
                <Description>${escapeXml("<p>PSD2 adapter used by <a href=\"https://bank.example.com\">three banks</a>.</p>")}</Description>
                <Link>https://gateway.example.com</Link>
            </Project>
        </Projects>
        <HobbiesAndInterests>
            <HobbyOrInterest>
                <Title>Mountain running</Title>
            </HobbyOrInterest>
        </HobbiesAndInterests>
        <Skills>
            <PersonCompetency>
                <hr:TaxonomyID>Digital_Skill</hr:TaxonomyID>
                <CompetencyName>TypeScript</CompetencyName>
            </PersonCompetency>
            <PersonCompetency>
                <hr:TaxonomyID>Digital_Skill</hr:TaxonomyID>
                <CompetencyName>PostgreSQL</CompetencyName>
            </PersonCompetency>
        </Skills>
        <ConferencesAndSeminars>
            <ConferenceAndSeminar>
                <Title>GopherCon EU talk</Title>
                <Date>
                    <StartDate><hr:FormattedDateTime>2023-06-20</hr:FormattedDateTime></StartDate>
                    <Ongoing>false</Ongoing>
                </Date>
                <Location>Berlin</Location>
            </ConferenceAndSeminar>
        </ConferencesAndSeminars>
        <CommunicationAndInterpersonalSkills>
            <CommunicationAndInterpersonalSkill>
                <Description>${escapeXml("<p>Mentored six junior engineers.</p>")}</Description>
            </CommunicationAndInterpersonalSkill>
        </CommunicationAndInterpersonalSkills>
        <Others>
            <Title>Awards</Title>
            <Other>
                <Title>Best fintech hack 2019</Title>
            </Other>
        </Others>
        <Others>
            <Title>Awards</Title>
            <Other>
                <Title>Employee of the year 2022</Title>
            </Other>
        </Others>
    </CandidateProfile>
    <RenderingInformation>
        <Design><Template>Template1</Template></Design>
    </RenderingInformation>
</Candidate>`;
}

export function skillsPassportXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SkillsPassport xmlns="http://europass.cedefop.europa.eu/Europass" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" locale="en">
    <DocumentInfo><DocumentType>ECV</DocumentType><XSDVersion>V3.4</XSDVersion></DocumentInfo>
    <LearnerInfo>
        <Identification>
            <PersonName><FirstName>Luka</FirstName><Surname>Perić</Surname></PersonName>
            <ContactInfo>
                <Address><Contact><Municipality>Zagreb</Municipality><Country><Code>HR</Code><Label>Croatia</Label></Country></Contact></Address>
                <Email><Contact>luka@example.com</Contact></Email>
                <TelephoneList><Telephone><Contact>+385 91 555 0101</Contact><Use><Code>mobile</Code></Use></Telephone></TelephoneList>
                <WebsiteList><Website><Contact>https://luka.example.com</Contact><Use><Code>personal</Code></Use></Website></WebsiteList>
            </ContactInfo>
            <Demographics>
                <Birthdate year="1988" month="--07" day="---03"/>
                <NationalityList><Nationality><Code>HR</Code><Label>Croatian</Label></Nationality></NationalityList>
            </Demographics>
            <Photo><MimeType>image/png</MimeType><Data>${PHOTO_DATA_URL.split(",")[1]}</Data></Photo>
        </Identification>
        <Headline><Type><Code>preferred_job</Code><Label>Preferred job</Label></Type><Description><Label>Site Reliability Engineer</Label></Description></Headline>
        <WorkExperienceList>
            <WorkExperience>
                <Period><From year="2016" month="--09"/><Current>true</Current></Period>
                <Position><Label>SRE</Label></Position>
                <Activities>${escapeXml("<ul><li>On-call lead</li><li>Terraform modules</li></ul>")}</Activities>
                <Employer>
                    <Name>Adriatic Cloud</Name>
                    <ContactInfo>
                        <Address><Contact><Municipality>Split</Municipality><Country><Code>HR</Code></Country></Contact></Address>
                        <Website><Contact>https://adriatic.example.com</Contact></Website>
                    </ContactInfo>
                </Employer>
            </WorkExperience>
        </WorkExperienceList>
        <EducationList>
            <Education>
                <Period><From year="2007"/><To year="2012" month="--06"/></Period>
                <Title>Master of Electrical Engineering</Title>
                <Activities>Control systems</Activities>
                <Organisation><Name>University of Zagreb</Name></Organisation>
                <Field><Code>07</Code><Label>Engineering</Label></Field>
            </Education>
        </EducationList>
        <Skills>
            <Linguistic>
                <MotherTongueList><MotherTongue><Description><Code>hr</Code><Label>Croatian</Label></Description></MotherTongue></MotherTongueList>
                <ForeignLanguageList>
                    <ForeignLanguage>
                        <Description><Code>de</Code></Description>
                        <ProficiencyLevel><Listening>B2</Listening><Reading>B2</Reading><SpokenInteraction>B1</SpokenInteraction><SpokenProduction>B1</SpokenProduction><Writing>A2</Writing></ProficiencyLevel>
                        <VerifiedBy><Certificate><Title>Goethe-Zertifikat B1</Title></Certificate></VerifiedBy>
                    </ForeignLanguage>
                </ForeignLanguageList>
            </Linguistic>
            <Communication><Description>Clear incident communication</Description></Communication>
            <Computer><Description>Linux, Kubernetes</Description></Computer>
            <Driving><Description><Licence>B</Licence><Licence>C</Licence></Description></Driving>
        </Skills>
        <AchievementList>
            <Achievement><Title><Code>publications</Code><Label>Publications</Label></Title><Description>SRE handbook chapter</Description></Achievement>
        </AchievementList>
    </LearnerInfo>
</SkillsPassport>`;
}

function latin1Bytes(value: string): Uint8Array {
    return Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

/**
 * Minimal PDF with the XML embedded the way Europass does it: a named
 * `/EmbeddedFile` stream referenced from the catalog's EmbeddedFiles tree.
 * Only the stream layout matters to the importer, so no xref table is written.
 */
export function europassPdf(xml: string | null, { compress = true }: { compress?: boolean } = {}): Uint8Array<ArrayBuffer> {
    const parts: Uint8Array[] = [
        latin1Bytes("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"),
        latin1Bytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(Europass-XML-Attachment.xml) 4 0 R] >> >> >>\nendobj\n"),
        latin1Bytes("2 0 obj\n<< /Type /Pages /Kids [5 0 R] /Count 1 >>\nendobj\n"),
    ];

    const pageContent = latin1Bytes("BT /F1 12 Tf 72 720 Td (Europass CV) Tj ET");
    parts.push(
        latin1Bytes(`5 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>\nendobj\n6 0 obj\n<< /Length ${pageContent.length} >>\nstream\n`),
        pageContent,
        latin1Bytes("\nendstream\nendobj\n"),
    );

    if (xml !== null) {
        const raw = new TextEncoder().encode(xml);
        const body = compress ? zlibSync(raw) : raw;
        // Key order copies a real Europass export: /Filter sits before /Length.
        const filter = compress ? "\n/Filter /FlateDecode" : "";
        parts.push(
            latin1Bytes(`3 0 obj\n<<\n/Type /EmbeddedFile\n/Subtype /text#2Fxml\n/Params <<\n/Size ${raw.length}\n>>${filter}\n/Length 7 0 R\n>>\nstream\r\n`),
            body,
            latin1Bytes("\r\nendstream\nendobj\n"),
            latin1Bytes(`7 0 obj\n${body.length}\nendobj\n`),
            latin1Bytes("4 0 obj\n<< /Type /Filespec /F (Europass-XML-Attachment.xml) /EF << /F 3 0 R >> >>\nendobj\n"),
        );
    }

    parts.push(latin1Bytes("trailer\n<< /Root 1 0 R >>\n%%EOF\n"));
    return concat(parts);
}
