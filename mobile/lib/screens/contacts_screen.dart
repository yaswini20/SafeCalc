import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final List<TextEditingController> _nameControllers = List.generate(3, (_) => TextEditingController());
  final List<TextEditingController> _phoneControllers = List.generate(3, (_) => TextEditingController());
  final List<String> _contactIds = List.generate(3, (_) => '');
  final List<String> _countryCodes = List.generate(3, (_) => '+91');
  
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  @override
  void dispose() {
    for (var controller in _nameControllers) {
      controller.dispose();
    }
    for (var controller in _phoneControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadContacts() async {
    setState(() {
      _loading = true;
    });

    final contacts = await ApiService.getContacts();

    // Clear all fields first
    for (int i = 0; i < 3; i++) {
      _nameControllers[i].clear();
      _phoneControllers[i].clear();
      _contactIds[i] = '';
      _countryCodes[i] = '+91';
    }

    // Prefill up to 3 contacts
    for (int i = 0; i < contacts.length && i < 3; i++) {
      final contact = contacts[i];
      _nameControllers[i].text = contact['name'] ?? '';
      _contactIds[i] = contact['_id'] ?? '';
      
      String rawPhone = contact['phone'] ?? '';
      // Simple parse for country code
      if (rawPhone.startsWith('+91')) {
        _countryCodes[i] = '+91';
        _phoneControllers[i].text = rawPhone.substring(3).trim();
      } else if (rawPhone.startsWith('+')) {
        // If it starts with another code, try to extract first 3 characters
        if (rawPhone.length > 3) {
          _countryCodes[i] = rawPhone.substring(0, 3);
          _phoneControllers[i].text = rawPhone.substring(3).trim();
        } else {
          _phoneControllers[i].text = rawPhone;
        }
      } else {
        _phoneControllers[i].text = rawPhone;
      }
    }

    setState(() {
      _loading = false;
    });
  }

  Future<void> _saveContacts() async {
    // Validate: if Name is filled, Phone must be filled, and vice versa
    for (int i = 0; i < 3; i++) {
      final name = _nameControllers[i].text.trim();
      final phone = _phoneControllers[i].text.trim();
      
      if ((name.isNotEmpty && phone.isEmpty) || (name.isEmpty && phone.isNotEmpty)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Please complete both Name and Phone for Contact ${i + 1}'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    setState(() {
      _saving = true;
    });

    try {
      for (int i = 0; i < 3; i++) {
        final name = _nameControllers[i].text.trim();
        final phone = _phoneControllers[i].text.trim();
        final id = _contactIds[i];
        final fullPhone = phone.isNotEmpty ? '${_countryCodes[i]}$phone' : '';

        if (name.isNotEmpty && phone.isNotEmpty) {
          if (id.isNotEmpty) {
            // Update existing contact
            await ApiService.updateContact(id, name, fullPhone, '', 'Contact ${i + 1}');
          } else {
            // Add new contact
            await ApiService.addContact(name, fullPhone, '', 'Contact ${i + 1}');
          }
        } else if (name.isEmpty && phone.isEmpty && id.isNotEmpty) {
          // Delete removed contact
          await ApiService.deleteContact(id);
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Guardian contacts saved successfully!'),
            backgroundColor: Colors.green,
          ),
        );
      }
      
      // Reload contacts to get latest IDs
      await _loadContacts();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving contacts: $e'),
            backgroundColor: Colors.red,
          ),
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

  Widget _buildContactForm(int index, String title) {
    const coralColor = Color(0xFFFF6D6D);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 12),
        // Name field
        TextFormField(
          controller: _nameControllers[index],
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'Name',
            floatingLabelStyle: TextStyle(color: coralColor),
          ),
        ),
        const SizedBox(height: 12),
        // Phone Row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Country Code Flag Box
            Container(
              height: 58,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withOpacity(0.12)),
              ),
              child: Row(
                children: [
                  const Text('🇮🇳', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 6),
                  Text(
                    _countryCodes[index],
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            // Phone Number field
            Expanded(
              child: TextFormField(
                controller: _phoneControllers[index],
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
        const SizedBox(height: 24),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF121212);
    const coralColor = Color(0xFFFF6D6D);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: const Text(
          'Trusted Contacts',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: coralColor))
          : Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _buildContactForm(0, 'CONTACT 1'),
                        _buildContactForm(1, 'CONTACT 2'),
                        _buildContactForm(2, 'CONTACT 3'),
                      ],
                    ),
                  ),
                ),
                // Save button
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _saveContacts,
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
    );
  }
}

