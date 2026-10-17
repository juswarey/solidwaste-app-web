import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../hooks';
import { getWasteCategories } from '../data/resident';
import { Card, Screen, ScreenTitle, StateView } from '../components/ui';
import { colors, type } from '../theme';

export default function GuideScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getWasteCategories);
  const [open, setOpen] = useState(null);

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle sub="Tap a category to see how to prepare it for pickup">Waste guide</ScreenTitle>
      <StateView
        loading={loading} error={error} onRetry={reload}
        empty={data && data.length === 0}
        emptyTitle="No categories yet"
        emptyText="Your LGU hasn’t added waste categories."
      />
      {data?.map((c) => {
        const isOpen = open === c.waste_category_id;
        return (
          <Card key={c.waste_category_id} onPress={() => setOpen(isOpen ? null : c.waste_category_id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[type.heading, { flex: 1 }]}>{c.category_name}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </View>
            {isOpen && (
              <Text style={[type.body, { marginTop: 10 }]}>
                {c.disposal_guidelines || 'No guidelines added yet.'}
              </Text>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
