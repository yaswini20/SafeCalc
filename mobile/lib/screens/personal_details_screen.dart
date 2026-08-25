import 'package:flutter/material.dart';
import '../services/api_service.dart';

class PersonalDetailsScreen extends StatefulWidget {
  const PersonalDetailsScreen({super.key});

  @override
  State<PersonalDetailsScreen> createState() => _PersonalDetailsScreenState();
}

class _PersonalDetailsScreenState extends State<PersonalDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Profile controllers
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  String _selectedGender = 'Female';
  String _selectedBloodGroup = 'O+';
  final _dobController = TextEditingController();

  // Contact 1 controllers
  final _contact1NameController = TextEditingController();
  final _contact1PhoneController = TextEditingController();
  String _contact1Id = '';
  
  bool _loading = true;
  bool _saving = false;

  final List<String> _genders = ['Male', 'Female', 'Other'];
  final List<String> _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _dobController.dispose();
    _contact1NameController.dispose();
    _contact1PhoneController.dispose();
    super.dispose();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _loading = true;
    });

    try {
      final profile = await ApiService.getUserProfile();
      if (profile != null) {
        _nameController.text = profile['name'] ?? '';
        _phoneController.text = _stripCountryCode(profile['phone'] ?? '');
        
        final dbGender = profile['gender'] ?? '';
        if (_genders.contains(dbGender)) {
          _selectedGender = dbGender;
        }
        
        final dbBlood = profile['bloodGroup'] ?? '';
        if (_bloodGroups.contains(dbBlood)) {
          _selectedBloodGroup = dbBlood;
        }

        _dobController.text = profile['dob'] ?? '';
      }

      final contacts = await ApiService.getContacts();
      if (contacts.isNotEmpty) {
        final contact1 = contacts[0];
        _contact1NameController.text = contact1['name'] ?? '';
        _contact1PhoneController.text = _stripCountryCode(contact1['phone'] ?? '');
        _contact1Id = contact1['_id'] ?? '';
      }
    } catch (e) {
      print('Error loading personal details: $e');
    }

    setState(() {
      _loading = false;
    });
  }

  String _stripCountryCode(String phone) {
    if (phone.startsWith('+91')) {
      return phone.substring(3).trim();
    } else if (phone.startsWith('+') && phone.length > 3) {
      return phone.substring(3).trim();
    }
    return phone;
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFFF6D6D),
              onPrimary: Colors.white,
              surface: Color(0xFF1E1E1E),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _dobController.text = "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    // Contact 1 validation
    final cName = _contact1NameController.text.trim();
    final cPhone = _contact1PhoneController.text.trim();
    if ((cName.isNotEmpty && cPhone.isEmpty) || (cName.isEmpty && cPhone.isNotEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please complete both Name and Phone for Contact 1'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      // 1. Save profile details
      await ApiService.updateUserProfile(
        name: _nameController.text.trim(),
        phone: '+91${_phoneController.text.trim()}',
        gender: _selectedGender,
        bloodGroup: _selectedBloodGroup,
        dob: _dobController.text.trim(),
      );

      // 2. Save Contact 1
      if (cName.isNotEmpty && cPhone.isNotEmpty) {
        final fullPhone = '+91$cPhone';
        if (_contact1Id.isNotEmpty) {
          await ApiService.updateContact(_contact1Id, cName, fullPhone, '', 'Contact 1');
        } else {
          await ApiService.addContact(cName, fullPhone, '', 'Contact 1');
        }
      } else if (cName.isEmpty && cPhone.isEmpty && _contact1Id.isNotEmpty) {
        await ApiService.deleteContact(_contact1Id);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile saved successfully!'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save profile details: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF121212);
    const coralColor = Color(0xFFFF6D6D);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: const Text('Personal Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: coralColor))
          : Form(
              key: _formKey,
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Full Name
                          TextFormField(
                            controller: _nameController,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'Full Name',
                              floatingLabelStyle: TextStyle(color: coralColor),
                            ),
                            validator: (val) => val!.trim().isEmpty ? 'Full name is required' : null,
                          ),
                          const SizedBox(height: 20),

                          // Phone Number
                          const Text(
                            'Phone Number',
                            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                height: 58,
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.white.withOpacity(0.12)),
                                ),
                                child: const Row(
                                  children: [
                                    Text('🇮🇳', style: TextStyle(fontSize: 20)),
                                    SizedBox(width: 8),
                                    Text('+91', style: TextStyle(color: Colors.white, fontSize: 14)),
                                    SizedBox(width: 4),
                                    Icon(Icons.arrow_drop_down, color: Colors.grey, size: 18),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _phoneController,
                                  style: const TextStyle(color: Colors.white),
                                  keyboardType: TextInputType.phone,
                                  decoration: const InputDecoration(
                                    labelText: '',
                                    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                  ),
                                  validator: (val) => val!.trim().isEmpty ? 'Phone number is required' : null,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Gender Dropdown
                          DropdownButtonFormField<String>(
                            value: _selectedGender,
                            dropdownColor: const Color(0xFF1E1E1E),
                            style: const TextStyle(color: Colors.white, fontSize: 16),
                            decoration: const InputDecoration(
                              labelText: 'Gender',
                              floatingLabelStyle: TextStyle(color: coralColor),
                            ),
                            icon: const Icon(Icons.arrow_drop_down, color: Colors.grey),
                            items: _genders.map((gender) {
                              return DropdownMenuItem<String>(
                                value: gender,
                                child: Text(gender),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() {
                                _selectedGender = val!;
                              });
                            },
                          ),
                          const SizedBox(height: 20),

                          // Blood Group Dropdown
                          DropdownButtonFormField<String>(
                            value: _selectedBloodGroup,
                            dropdownColor: const Color(0xFF1E1E1E),
                            style: const TextStyle(color: Colors.white, fontSize: 16),
                            decoration: const InputDecoration(
                              labelText: 'Blood Group',
                              floatingLabelStyle: TextStyle(color: coralColor),
                            ),
                            icon: const Icon(Icons.arrow_drop_down, color: Colors.grey),
                            items: _bloodGroups.map((bg) {
                              return DropdownMenuItem<String>(
                                value: bg,
                                child: Text(bg),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() {
                                _selectedBloodGroup = val!;
                              });
                            },
                          ),
                          const SizedBox(height: 20),

                          // Date of Birth
                          TextFormField(
                            controller: _dobController,
                            style: const TextStyle(color: Colors.white),
                            readOnly: true,
                            onTap: _selectDate,
                            decoration: InputDecoration(
                              labelText: 'Date of Birth',
                              floatingLabelStyle: const TextStyle(color: coralColor),
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.calendar_month, color: coralColor),
                                onPressed: _selectDate,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          const Divider(color: Colors.white10),
                          const SizedBox(height: 16),

                          // CONTACT 1 Title
                          const Text(
                            'CONTACT 1',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Contact 1 Name
                          TextFormField(
                            controller: _contact1NameController,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'Name',
                              floatingLabelStyle: TextStyle(color: coralColor),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Contact 1 Phone Row
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                height: 58,
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.white.withOpacity(0.12)),
                                ),
                                child: const Row(
                                  children: [
                                    Text('🇮🇳', style: TextStyle(fontSize: 20)),
                                    SizedBox(width: 8),
                                    Text('+91', style: TextStyle(color: Colors.white, fontSize: 14)),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _contact1PhoneController,
                                  style: const TextStyle(color: Colors.white),
                                  keyboardType: TextInputType.phone,
                                  decoration: const InputDecoration(
                                    labelText: 'Phone',
                                    floatingLabelStyle: TextStyle(color: coralColor),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
                  
                  // Save & Continue Button
                  Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _saving ? null : _save,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: coralColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(28.0),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'SAVE & CONTINUE',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
