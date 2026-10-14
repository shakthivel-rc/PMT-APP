
import React from 'react';
import RolesAndPermissionsClient from './RolesAndPermissionsClient';

/**
 * This used to hold a module-scoped `Promise.all([roles, permissions])` fed to `use()` and
 * reset only inside `.catch`. Since routes are `React.lazy` and unmount on navigation,
 * revisiting the screen replayed the promise resolved *before* any mutation — so a newly
 * created permission disappeared on the next visit, and the resolved data outlived logout.
 *
 * The client already owned a `refreshData` for its own mutations; it now owns the initial
 * load too, so there is exactly one owner of this data instead of two that disagree.
 */
const RolesAndPermissions: React.FC = () => <RolesAndPermissionsClient />;

export default RolesAndPermissions;
