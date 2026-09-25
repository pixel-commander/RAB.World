# Food Process / Industrial Extension

Recommended conceptual home: `tools/food-process/`

Same reducer/missing-seat/receipt laws apply.

## Typical process Shape
product: type, mass, geometry, thickness, composition, initial_temperature
equipment: process_length, belt_speed, set_temperature, airflow, humidity, equipment_id
target: product_temperature, lethality/validated outcome, throughput
verification: sensor_reading, measurement_location, timestamp, process_run_id

## Example — residence time
belt_length=40 ft, belt_speed=8 ft/min, residence_time=? → 5 min.

## Example — belt speed
belt_length=40 ft, required_residence_time=7.5 min, belt_speed=? → ~5.33 ft/min.

## Example — underdetermined
chicken_thickness=2 in, belt_length=40 ft, belt_speed=?, oven_temperature=?
Without a validated thermal/process relationship or another constraint: UNRESOLVED. Do not invent a speed/temperature pair.

## Process authority
FSIS HACCP validation distinguishes scientific/technical support from practical in-plant evidence. Critical operational parameters may include time, temperature, humidity, dwell time, pH, concentration, water activity, pressure, product coverage, spatial configuration, and equipment settings/calibration.

Therefore:
generic math → candidate operating point
validated process support + actual process data → safety authority

A process change can trigger reassessment/revalidation rather than silent reuse of an old rule.
