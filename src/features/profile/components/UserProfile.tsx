import React, { useState, useEffect, useRef } from 'react';
import { UserRound, Camera, Loader2 } from 'lucide-react';
import ThemePicker from '@/components/ThemePicker';
import { BRAND_NAME } from '@/config/nav';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateUserProfile, changePassword } from '../../auth/authSlice';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import FormMessage from '@/components/FormMessage';
import { isPasswordStrong, PASSWORD_MIN_LENGTH } from '@/lib/passwordRules';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const UserProfile: React.FC = () => {
  const { user, status } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setOrganization(user.organization || '');
      setDepartment(user.department || '');
      setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim()) {
      dispatch(updateUserProfile({
        first_name: firstName,
        last_name: lastName,
        organization,
        department,
      }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      setPwError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, a number and a symbol, with no spaces.`,
      );
      return;
    }
    setPwLoading(true);
    try {
      await dispatch(changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })).unwrap();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess('Your password has been updated.');
    } catch (err: any) {
      setPwError(err || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const savingProfile = status === 'loading';

  return (
    <PageContainer>
      <PageHeader title="My Profile" icon={UserRound} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>
              Update your personal details and profile picture.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  aria-label="Change profile picture"
                  className="group relative size-24 shrink-0 overflow-hidden rounded-full bg-primary/12 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-3xl font-bold text-primary">
                      {user?.first_name?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Camera className="size-5" aria-hidden="true" />
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={triggerFileInput}
                >
                  Change Picture
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={user?.username || ''}
                  autoComplete="username"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  autoComplete="email"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization</Label>
                  <Input
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    autoComplete="organization-title"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password keeps the sidebar column. */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Choose a strong password you don&apos;t use elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <PasswordInput
                    id="current_password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPwError('');
                      setPwSuccess('');
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <PasswordInput
                    id="new_password"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPwError('');
                      setPwSuccess('');
                    }}
                  />
                  {newPassword && <PasswordStrengthMeter password={newPassword} />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_new_password">Confirm New Password</Label>
                  <PasswordInput
                    id="confirm_new_password"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPwError('');
                      setPwSuccess('');
                    }}
                  />
                </div>
                {pwError && <FormMessage variant="error">{pwError}</FormMessage>}
                {pwSuccess && (
                  <FormMessage variant="success">{pwSuccess}</FormMessage>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={pwLoading}>
                    {pwLoading && (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    )}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Ten themes need the full row — in a one-third column the names truncate. */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Choose how {BRAND_NAME} looks. Hover a theme to preview it across the whole app; the
              change applies as soon as you pick one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default UserProfile;
