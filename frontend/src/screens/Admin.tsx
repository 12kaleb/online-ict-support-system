'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Shield, User, Trash2, X, AlertCircle, CheckCircle2, Search, Filter, Edit2, Key, MailCheck, Ban, FileSpreadsheet, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { handleResponse } from '../utils/apiUtils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { canInviteStaff, isAdmin } from '../lib/permissions';

export default function Admin() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const isAdminUser = isAdmin(currentUser);
  const canInviteStaffUser = canInviteStaff(currentUser);
  const isStaffInviteOnly = currentUser?.role === 'manager' && Boolean(currentUser?.canInviteStaff);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'technician', department: '' });
  const [loading, setLoading] = useState(false);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Role Edit state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');

  // User Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState({ id: '', name: '', email: '', role: '', department: '' });

  // Password Reset state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  // Confirmation Dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    color: 'primary' as 'primary' | 'danger'
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void, color: 'primary' | 'danger' = 'primary') => {
    setConfirmConfig({ title, message, onConfirm, color });
    setConfirmOpen(true);
  };

  const fetchUsers = async () => {
    if (!isAdminUser) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await handleResponse(res);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdminUser]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInviteStaffUser) {
      toast.error('You do not have permission to invite users');
      setOpen(false);
      return;
    }

    try {
      const invitePayload = {
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        department: newUser.department.trim(),
        role: isStaffInviteOnly ? 'staff' : newUser.role,
      };
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitePayload),
      });
      await handleResponse(res);
      toast.success('Invitation created successfully');
      setOpen(false);
      setNewUser({ name: '', email: '', role: isStaffInviteOnly ? 'staff' : 'technician', department: '' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const action = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
        await handleResponse(res);
        toast.success('User role updated');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update role');
      }
      setConfirmOpen(false);
      setRoleDialogOpen(false);
    };

    openConfirm(
      t('Confirm Role Change'),
      t('Are you sure you want to change this user\'s role to {{role}}?', { role: t(newRole) }),
      action,
      'primary'
    );
  };

  const handleOpenEditRole = (user: any) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleOpenEditUser = (user: any) => {
    setEditUser({ 
      id: user.id, 
      name: user.name || '', 
      email: user.email || '',
      role: user.role || 'staff',
      department: user.department || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editUser.name.trim(), 
          email: editUser.email.trim().toLowerCase(),
          role: editUser.role,
          department: editUser.department.trim()
        }),
      });
      await handleResponse(res);
      toast.success('User updated successfully');
      setEditDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      await handleResponse(res);
      toast.success('Password reset successfully');
      setResetDialogOpen(false);
      setResetPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const action = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        });
        await handleResponse(res);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete user');
      }
      setConfirmOpen(false);
    };

    openConfirm(
      t('Confirm Delete'),
      t('Are you sure you want to delete this user? This action cannot be undone.'),
      action,
      'danger'
    );
  };

  const handleUpdateStatus = async (userId: string, status: 'active' | 'disabled') => {
    const action = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        await handleResponse(res);
        toast.success(status === 'active' ? 'User approved successfully' : 'User disabled successfully');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update status');
      }
      setConfirmOpen(false);
    };

    openConfirm(
      status === 'active' ? t('Approve Account') : t('Disable Account'),
      status === 'active'
        ? t('This user will be able to sign in immediately.')
        : t('This user will no longer be able to sign in until reactivated.'),
      action,
      status === 'active' ? 'primary' : 'danger',
    );
  };

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleImportUsers = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await fetch('/api/import/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileBase64 }),
      });
      const summary = await handleResponse(res);
      setImportSummary(summary);
      toast.success(`Imported ${summary.created || 0} users`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to import users');
    } finally {
      setImporting(false);
    }
  };

  const handleUpdateManagerPermission = async (userId: string, canInviteStaff: boolean) => {
    const action = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/manager-user-permission`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canInviteStaff }),
        });
        await handleResponse(res);
        toast.success(canInviteStaff ? 'Manager can now invite staff' : 'Manager staff invite permission revoked');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update permission');
      }
      setConfirmOpen(false);
    };

    openConfirm(
      canInviteStaff ? t('Grant Staff Invite Permission') : t('Revoke Staff Invite Permission'),
      canInviteStaff
        ? t('This manager will be able to invite staff users only.')
        : t('This manager will no longer be able to invite staff users.'),
      action,
      canInviteStaff ? 'primary' : 'danger',
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800';
      case 'manager': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'technician': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'staff': return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'disabled': return 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const renderUserActions = (user: any) => (
    <>
      {user.role === 'manager' && (
        <button
          onClick={() => handleUpdateManagerPermission(user.id, !user.canInviteStaff)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all",
            user.canInviteStaff
              ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
              : "hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
          )}
          title={user.canInviteStaff ? t('Revoke Staff Invite Permission') : t('Grant Staff Invite Permission')}
        >
          <UserPlus size={18} />
        </button>
      )}
      {user.status === 'pending' && (
        <button
          onClick={() => handleUpdateStatus(user.id, 'active')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
          title={t('Approve User')}
        >
          <MailCheck size={18} />
        </button>
      )}
      {user.status !== 'disabled' && (
        <button
          onClick={() => handleUpdateStatus(user.id, 'disabled')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
          title={t('Disable User')}
        >
          <Ban size={18} />
        </button>
      )}
      <button
        onClick={() => handleOpenEditUser(user)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
        title={t('Edit User')}
      >
        <Edit2 size={18} />
      </button>
      <button
        onClick={() => {
          setSelectedUser(user);
          setResetPassword('');
          setResetDialogOpen(true);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
        title={t('Reset Password')}
      >
        <Key size={18} />
      </button>
      <button
        onClick={() => handleOpenEditRole(user)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
        title={t('Edit Role')}
      >
        <Shield size={18} />
      </button>
      <button
        onClick={() => handleDeleteUser(user.id)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        title={t('Delete User')}
      >
        <Trash2 size={18} />
      </button>
    </>
  );

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">{t('User Management')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {isStaffInviteOnly
              ? t('Invite staff users to the system.')
              : t('Manage roles, approvals, and invite-based user onboarding.')}
          </p>
        </div>
        {canInviteStaffUser && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              onClick={() => setImportOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
            >
              <FileSpreadsheet size={20} />
              {t('Import Excel')}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 dark:shadow-none sm:w-auto sm:px-6"
            >
              <UserPlus size={20} />
              {isStaffInviteOnly ? t('Invite Staff') : t('Add New User')}
            </button>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      {isAdminUser && <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder={t('Search users by name or email...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
          />
        </div>
        <div className="relative w-full md:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none text-slate-900 dark:text-white"
          >
            <option value="all">{t('All Roles')}</option>
            <option value="admin">{t('Admin')}</option>
            <option value="staff">{t('Staff')}</option>
            <option value="technician">{t('Technician')}</option>
            <option value="manager">{t('Manager')}</option>
          </select>
        </div>
      </div>}

      {isAdminUser && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 p-3 md:hidden">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
              <p className="font-medium text-slate-400 dark:text-slate-500">{t('Loading users...')}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-4 py-12 text-center italic text-slate-400 dark:text-slate-500">
              {t('No users found')}
            </div>
          ) : (
            filteredUsers.map((user, idx) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {user.name?.charAt(0) || <User size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800 dark:text-slate-100">{user.name || '-'}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{user.email || '-'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                    getRoleBadgeColor(user.role)
                  )}>
                    {t(user.role)}
                  </span>
                  <span className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                    getStatusBadgeColor(user.status)
                  )}>
                    {t(user.status)}
                  </span>
                  {user.role === 'manager' && (
                    <span className={cn(
                      "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                      user.canInviteStaff
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}>
                      {user.canInviteStaff ? t('Allowed') : t('Revoked')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-1 rounded-xl bg-white p-1 dark:bg-slate-900">
                  {renderUserActions(user)}
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-bottom border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Name')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Email')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Role')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Status')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Staff Invite')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-400 dark:text-slate-500 font-medium">{t('Loading users...')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                    {t('No users found')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => (
                  <motion.tr 
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                          {user.name?.charAt(0) || <User size={20} />}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{user.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        getRoleBadgeColor(user.role)
                      )}>
                        {t(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        getStatusBadgeColor(user.status)
                      )}>
                        {t(user.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'manager' ? (
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          user.canInviteStaff
                            ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        )}>
                          {user.canInviteStaff ? t('Allowed') : t('Revoked')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300 dark:text-slate-700">-</span>
                      )}
                    </td>
                    <td className="flex justify-end gap-1 px-6 py-4 text-right">
                      {renderUserActions(user)}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Add User Dialog */}
      <AnimatePresence>
        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setImportOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('Import Users')}</h2>
                  <button onClick={() => setImportOpen(false)} className="rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>

                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 px-6 py-10 text-center transition-all hover:bg-indigo-50 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                  <Upload size={28} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="font-black text-slate-800 dark:text-slate-100">{importing ? t('Importing...') : t('Choose Excel File')}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('Columns')}: name, email, role, department
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={importing}
                    className="hidden"
                    onChange={(e) => handleImportUsers(e.target.files?.[0])}
                  />
                </label>

                {importSummary && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {t('Created')}: {importSummary.created || 0} / {t('Updated')}: {importSummary.updated || 0} / {t('Skipped')}: {importSummary.skipped?.length || 0}
                    </p>
                    {importSummary.skipped?.length > 0 && (
                      <div className="mt-3 max-h-36 space-y-1 overflow-y-auto text-sm text-rose-600 dark:text-rose-400">
                        {importSummary.skipped.slice(0, 8).map((item: any) => (
                          <p key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('Invite New User')}</h2>
                  <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>

                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Name')}</label>
                    <input 
                      type="text"
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                      placeholder={t('Full Name')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Email')}</label>
                    <input 
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Department')}</label>
                    <input 
                      type="text"
                      required
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                      placeholder={t('Department')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Role')}</label>
                    {isStaffInviteOnly ? (
                      <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold">
                        {t('Staff')}
                      </div>
                    ) : (
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none text-slate-900 dark:text-white"
                      >
                        <option value="staff">{t('Staff')}</option>
                        <option value="technician">{t('Technician')}</option>
                        <option value="manager">{t('Manager')}</option>
                      </select>
                    )}
                  </div>
                  <p className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700 dark:border-cyan-900/30 dark:bg-cyan-900/20 dark:text-cyan-300">
                    {t('A secure invite email will be sent so this user can set their own password.')}
                  </p>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                    <button 
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                    >
                      {t('Cancel')}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      {t('Send Invite')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Dialog */}
      <AnimatePresence>
        {editDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditDialogOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('Edit User')}</h2>
                  <button onClick={() => setEditDialogOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Name')}</label>
                    <input 
                      type="text"
                      required
                      value={editUser.name}
                      onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Email')}</label>
                    <input 
                      type="email"
                      required
                      value={editUser.email}
                      onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                    <button 
                      type="button"
                      onClick={() => setEditDialogOpen(false)}
                      className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                    >
                      {t('Cancel')}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      {t('Save Changes')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Role Edit Dialog */}
      <AnimatePresence>
        {roleDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoleDialogOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('Edit User Role')}</h2>
                  <button onClick={() => setRoleDialogOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-sm text-indigo-700 dark:text-indigo-400">
                      {t('Changing role for')}: <span className="font-black">{selectedUser?.name || t('User')}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('Select New Role')}</label>
                    <select 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none text-slate-900 dark:text-white"
                    >
                      <option value="staff">{t('Staff')}</option>
                      <option value="technician">{t('Technician')}</option>
                      <option value="manager">{t('Manager')}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <button 
                      onClick={() => setRoleDialogOpen(false)}
                      className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                    >
                      {t('Cancel')}
                    </button>
                    <button 
                      onClick={() => handleUpdateRole(selectedUser.id, newRole)}
                      className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      {t('Update Role')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Dialog */}
      <AnimatePresence>
        {resetDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetDialogOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('Reset Password')}</h2>
                  <button onClick={() => setResetDialogOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {t('Resetting password for')}: <span className="font-black">{selectedUser?.name || t('User')}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">{t('New Password')}</label>
                    <input 
                      type="password"
                      required
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                      placeholder="••••••••"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-400 ml-1">{t('Minimum 6 characters')}</p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <button 
                      type="button"
                      onClick={() => setResetDialogOpen(false)}
                      className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                    >
                      {t('Cancel')}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      {t('Reset Password')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 text-center sm:p-8">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                  confirmConfig.color === 'danger' ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                )}>
                  {confirmConfig.color === 'danger' ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{confirmConfig.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8">{confirmConfig.message}</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button 
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={confirmConfig.onConfirm}
                    className={cn(
                      "flex-1 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg",
                      confirmConfig.color === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                    )}
                  >
                    {t('Confirm')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
