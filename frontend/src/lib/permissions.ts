export function isAdmin(user: any) {
  return user?.role === 'admin';
}

export function canInviteStaff(user: any) {
  return isAdmin(user) || (user?.role === 'manager' && Boolean(user?.canInviteStaff));
}

export function isManager(user: any) {
  return user?.role === 'manager' || isAdmin(user);
}

export function isTechnician(user: any) {
  return user?.role === 'technician';
}

export function isPrivileged(user: any) {
  return isManager(user) || isTechnician(user);
}

export function isStaff(user: any) {
  return user?.role === 'staff' || isPrivileged(user);
}
