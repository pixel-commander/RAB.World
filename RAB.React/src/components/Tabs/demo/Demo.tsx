import { Tabs } from '../Tabs';
const First = () => { return <p>First tab content.</p>; };
const Second = () => { return <p>Second tab content.</p>; };
const tabs = [{ id: 'first', name: 'First', View: First }, { id: 'second', name: 'Second', View: Second }];
export default () => {
  return <Tabs tabs={tabs} use_url />;
};
