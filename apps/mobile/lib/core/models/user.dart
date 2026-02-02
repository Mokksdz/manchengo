/// User roles in Manchengo Smart ERP
enum UserRole {
  admin,
  appro,
  production,
  commercial,
  comptable,
}

extension UserRoleExtension on UserRole {
  String get label {
    switch (this) {
      case UserRole.admin:
        return 'ADMIN';
      case UserRole.appro:
        return 'APPRO';
      case UserRole.production:
        return 'PRODUCTION';
      case UserRole.commercial:
        return 'COMMERCIAL';
      case UserRole.comptable:
        return 'COMPTABLE';
    }
  }

  String get displayName {
    switch (this) {
      case UserRole.admin:
        return 'Administrateur';
      case UserRole.appro:
        return 'Approvisionnement';
      case UserRole.production:
        return 'Production';
      case UserRole.commercial:
        return 'Commercial';
      case UserRole.comptable:
        return 'Comptable';
    }
  }
}

/// User model
class User {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final UserRole role;
  final bool isActive;

  const User({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    this.isActive = true,
  });

  String get fullName => '$firstName $lastName';
}
