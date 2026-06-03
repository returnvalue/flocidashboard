"""Interactive SES helpers for local email workflows."""

from __future__ import annotations

from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from .aws import FlociClientFactory, _clean_response


def _ses_client():
    return FlociClientFactory().client('ses')


def _sesv2_client():
    return FlociClientFactory().client('sesv2')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _list_value(value: Any, label: str) -> list[Any]:
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    return value


def verify_email_identity(email_address: str) -> dict[str, Any]:
    email = _required(email_address, 'Email address')
    response = _ses_client().verify_email_identity(EmailAddress=email)
    return {'identity': email, 'response': _clean_response(response)}


def verify_domain_identity(domain: str) -> dict[str, Any]:
    clean_domain = _required(domain, 'Domain')
    response = _ses_client().verify_domain_identity(Domain=clean_domain)
    return {
        'identity': clean_domain,
        'verification_token': response.get('VerificationToken'),
        'response': _clean_response(response),
    }


def delete_identity(identity: str) -> dict[str, Any]:
    clean_identity = _required(identity, 'Identity')
    response = _ses_client().delete_identity(Identity=clean_identity)
    return {'identity': clean_identity, 'response': _clean_response(response)}


def send_email(
    *,
    source: str,
    to_addresses: Any,
    subject: str,
    text: str = '',
    html: str = '',
    cc_addresses: Any = None,
    bcc_addresses: Any = None,
    configuration_set_name: str = '',
) -> dict[str, Any]:
    to_list = [str(address).strip() for address in _list_value(to_addresses, 'To addresses') if str(address).strip()]
    if not to_list:
        raise ValueError('At least one recipient is required')

    body: dict[str, Any] = {}
    if text:
        body['Text'] = {'Data': text}
    if html:
        body['Html'] = {'Data': html}
    if not body:
        raise ValueError('Text or HTML body is required')

    payload: dict[str, Any] = {
        'Source': _required(source, 'Source'),
        'Destination': {
            'ToAddresses': to_list,
            'CcAddresses': [str(address).strip() for address in _list_value(cc_addresses, 'Cc addresses') if str(address).strip()],
            'BccAddresses': [str(address).strip() for address in _list_value(bcc_addresses, 'Bcc addresses') if str(address).strip()],
        },
        'Message': {
            'Subject': {'Data': _required(subject, 'Subject')},
            'Body': body,
        },
    }
    if configuration_set_name:
        payload['ConfigurationSetName'] = configuration_set_name
    response = _ses_client().send_email(**payload)
    return {'message_id': response.get('MessageId'), 'response': _clean_response(response)}


def send_raw_email(*, source: str, destinations: Any, raw_message: str) -> dict[str, Any]:
    destination_list = [str(address).strip() for address in _list_value(destinations, 'Destinations') if str(address).strip()]
    if not destination_list:
        raise ValueError('At least one destination is required')
    response = _ses_client().send_raw_email(
        Source=_required(source, 'Source'),
        Destinations=destination_list,
        RawMessage={'Data': _required(raw_message, 'Raw message')},
    )
    return {'message_id': response.get('MessageId'), 'response': _clean_response(response)}


def create_template(template_name: str, *, subject: str, text: str = '', html: str = '') -> dict[str, Any]:
    name = _required(template_name, 'Template name')
    response = _ses_client().create_template(Template={
        'TemplateName': name,
        'SubjectPart': _required(subject, 'Subject'),
        'TextPart': text,
        'HtmlPart': html,
    })
    return {'template_name': name, 'response': _clean_response(response)}


def update_template(template_name: str, *, subject: str, text: str = '', html: str = '') -> dict[str, Any]:
    name = _required(template_name, 'Template name')
    response = _ses_client().update_template(Template={
        'TemplateName': name,
        'SubjectPart': _required(subject, 'Subject'),
        'TextPart': text,
        'HtmlPart': html,
    })
    return {'template_name': name, 'response': _clean_response(response)}


def delete_template(template_name: str) -> dict[str, Any]:
    name = _required(template_name, 'Template name')
    response = _ses_client().delete_template(TemplateName=name)
    return {'template_name': name, 'response': _clean_response(response)}


def send_templated_email(
    *,
    source: str,
    to_addresses: Any,
    template_name: str,
    template_data: Any,
    configuration_set_name: str = '',
) -> dict[str, Any]:
    to_list = [str(address).strip() for address in _list_value(to_addresses, 'To addresses') if str(address).strip()]
    if not to_list:
        raise ValueError('At least one recipient is required')
    payload: dict[str, Any] = {
        'Source': _required(source, 'Source'),
        'Destination': {'ToAddresses': to_list},
        'Template': _required(template_name, 'Template name'),
        'TemplateData': _required(template_data, 'Template data'),
    }
    if configuration_set_name:
        payload['ConfigurationSetName'] = configuration_set_name
    response = _ses_client().send_templated_email(**payload)
    return {'message_id': response.get('MessageId'), 'response': _clean_response(response)}


def render_template(template_name: str, template_data: str) -> dict[str, Any]:
    name = _required(template_name, 'Template name')
    response = _ses_client().test_render_template(
        TemplateName=name,
        TemplateData=_required(template_data, 'Template data'),
    )
    return {'template_name': name, 'rendered_template': response.get('RenderedTemplate'), 'response': _clean_response(response)}


def update_sending_enabled(enabled: Any) -> dict[str, Any]:
    response = _ses_client().update_account_sending_enabled(Enabled=bool(enabled))
    return {'enabled': bool(enabled), 'response': _clean_response(response)}


def create_configuration_set(name: str, tags: Any = None) -> dict[str, Any]:
    clean_name = _required(name, 'Configuration set name')
    payload: dict[str, Any] = {'ConfigurationSetName': clean_name}
    clean_tags = _list_value(tags, 'Tags')
    if clean_tags:
        payload['Tags'] = clean_tags
    response = _sesv2_client().create_configuration_set(**payload)
    return {'configuration_set_name': clean_name, 'response': _clean_response(response)}


def delete_configuration_set(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Configuration set name')
    response = _sesv2_client().delete_configuration_set(ConfigurationSetName=clean_name)
    return {'configuration_set_name': clean_name, 'response': _clean_response(response)}


def put_event_destination(configuration_set_name: str, event_destination_name: str, event_destination: Any) -> dict[str, Any]:
    clean_set = _required(configuration_set_name, 'Configuration set name')
    clean_name = _required(event_destination_name, 'Event destination name')
    response = _sesv2_client().create_configuration_set_event_destination(
        ConfigurationSetName=clean_set,
        EventDestinationName=clean_name,
        EventDestination=_dict_value(event_destination, 'Event destination'),
    )
    return {
        'configuration_set_name': clean_set,
        'event_destination_name': clean_name,
        'response': _clean_response(response),
    }


def delete_event_destination(configuration_set_name: str, event_destination_name: str) -> dict[str, Any]:
    clean_set = _required(configuration_set_name, 'Configuration set name')
    clean_name = _required(event_destination_name, 'Event destination name')
    response = _sesv2_client().delete_configuration_set_event_destination(
        ConfigurationSetName=clean_set,
        EventDestinationName=clean_name,
    )
    return {
        'configuration_set_name': clean_set,
        'event_destination_name': clean_name,
        'response': _clean_response(response),
    }


def clear_mailbox() -> dict[str, Any]:
    factory = FlociClientFactory()
    mailbox_url = f'{factory.endpoint_url.rstrip("/")}/_aws/ses'
    request = Request(mailbox_url, method='DELETE')
    try:
        with urlopen(request, timeout=3) as response:
            body = response.read().decode('utf-8')
            status = response.status
    except URLError as exc:
        raise ValueError(f'Could not clear SES mailbox: {exc.reason}') from exc
    except TimeoutError as exc:
        raise ValueError(f'Could not clear SES mailbox: {exc}') from exc
    return {'mailbox_url': mailbox_url, 'status': status, 'body': body}
