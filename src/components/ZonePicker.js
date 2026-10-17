import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getZones } from '../data/resident';
import { colors, type } from '../theme';
import { Chip } from './ui';

/** Lets the resident choose the collection zone their home belongs to. */
export default function ZonePicker({ value, onChange }) {
  const [zones, setZones] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getZones().then(setZones).catch((e) => setError(e.message));
  }, []);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.label, { marginBottom: 8 }]}>Your collection zone</Text>
      {!zones && !error && <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start' }} />}
      {error && <Text style={[type.small, { color: colors.danger }]}>{error}</Text>}
      {zones && zones.length === 0 && (
        <Text style={type.small}>No zones have been set up yet. Ask your barangay office.</Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {zones?.map((z) => (
          <Chip
            key={z.route_id}
            label={z.zone_name}
            selected={String(value) === String(z.route_id)}
            onPress={() => onChange(z.route_id)}
          />
        ))}
      </View>
      <Text style={[type.small, { marginTop: 2 }]}>Your schedule and truck map depend on this.</Text>
    </View>
  );
}
