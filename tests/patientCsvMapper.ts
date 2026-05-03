// @ts-nocheck
const requireFallback = require('./requireFallback.ts');
const moment = requireFallback('moment');

const CSV_TAG_SYSTEM = 'http://openclientregistry.org/fhir/tag/csv';
const CSV_TAG_CODE = '50a0ed16-c2e6-4319-8687-43a6a1a2d1e7';
const OPENMRS_SYSTEM = 'http://clientregistry.org/openmrs';
const NATIONAL_ID_SYSTEM = 'http://health.go.ug/cr/nationalid';
const ART_NUMBER_SYSTEM = 'http://health.go.ug/cr/artnumber';

const normalizeString = value => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeGender = value => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'm' || normalized === 'male') {
    return 'male';
  }
  if (normalized === 'f' || normalized === 'female') {
    return 'female';
  }
  return 'unknown';
};

const normalizeBirthDate = value => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const birthMoment = moment(
    normalized,
    ['YYYY-MM-DD', 'YYYYMMDD', 'DD-MMM-YYYY'],
    true
  );

  if (!birthMoment.isValid()) {
    return undefined;
  }

  return birthMoment.format('YYYY-MM-DD');
};

const buildPatientResource = (row, metaDisplay) => {
  const recId = normalizeString(row.rec_id || row['Unique ID']);
  const givenName = normalizeString(row.given_name);
  const surname = normalizeString(row.surname);
  const phoneNumber = normalizeString(row.phone_number);
  const nationalId = normalizeString(row.uganda_nin);
  const artNumber = normalizeString(row.art_number);
  const birthDate = normalizeBirthDate(row.date_of_birth || row.dob);

  const resource = {
    resourceType: 'Patient',
    meta: {
      tag: [{
        system: CSV_TAG_SYSTEM,
        code: CSV_TAG_CODE,
        display: metaDisplay,
      }],
    },
    active: true,
    gender: normalizeGender(row.sex || row.gender),
  };

  if (givenName || surname) {
    const name = {
      use: 'official',
    };
    if (givenName) {
      name.given = [givenName];
    }
    if (surname) {
      name.family = surname;
    }
    resource.name = [name];
  }

  if (phoneNumber) {
    resource.telecom = [{
      system: 'phone',
      value: phoneNumber,
    }];
  }

  resource.identifier = [];
  if (recId) {
    resource.identifier.push({
      system: OPENMRS_SYSTEM,
      value: recId,
    });
  }
  if (nationalId) {
    resource.identifier.push({
      system: NATIONAL_ID_SYSTEM,
      value: nationalId,
    });
  }
  if (artNumber) {
    resource.identifier.push({
      system: ART_NUMBER_SYSTEM,
      value: artNumber,
    });
  }

  if (birthDate) {
    resource.birthDate = birthDate;
  }

  return resource;
};

module.exports = {
  buildPatientResource,
};
