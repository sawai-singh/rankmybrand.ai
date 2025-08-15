"""
Message Translator for Intelligence Engine
Translates messages from AI Response Monitor format to Intelligence Engine format
"""

from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class MessageTranslator:
    """
    Translates messages between different service formats.
    Handles field mappings and ensures required fields are present.
    """
    
    @staticmethod
    def translate_ai_monitor_message(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate AI Response Monitor message format to Intelligence Engine format.
        
        AI Monitor sends:
        - prompt: str
        - response: str
        - platform: str
        - citations: List[Dict]
        - timestamp: str
        - metadata: Dict
        
        Intelligence Engine expects:
        - promptText: str
        - responseText: str
        - platform: str
        - citations: List[Dict]
        - collectedAt: str
        - metadata: Dict
        - brand_id: str (REQUIRED)
        - customer_id: str (REQUIRED)
        """
        
        # Extract metadata
        metadata = data.get('metadata', {})
        
        # Extract brand_id and customer_id from various possible locations
        brand_id = (
            data.get('brand_id') or
            data.get('brandId') or
            metadata.get('brand_id') or
            metadata.get('brandId') or
            data.get('data', {}).get('brand_id') or
            data.get('data', {}).get('brandId')
        )
        
        customer_id = (
            data.get('customer_id') or
            data.get('customerId') or
            metadata.get('customer_id') or
            metadata.get('customerId') or
            data.get('data', {}).get('customer_id') or
            data.get('data', {}).get('customerId')
        )
        
        # Check if we're dealing with wrapped message (from event bus)
        if 'data' in data and isinstance(data['data'], dict):
            inner_data = data['data']
            # Extract from inner data
            prompt_text = inner_data.get('prompt', inner_data.get('promptText', ''))
            response_text = inner_data.get('response', inner_data.get('responseText', ''))
            platform = inner_data.get('platform', 'unknown')
            citations = inner_data.get('citations', [])
            collected_at = inner_data.get('timestamp', inner_data.get('collectedAt'))
            inner_metadata = inner_data.get('metadata', {})
            message_id = inner_data.get('id', data.get('correlationId', ''))
        else:
            # Direct message format
            prompt_text = data.get('prompt', data.get('promptText', ''))
            response_text = data.get('response', data.get('responseText', ''))
            platform = data.get('platform', 'unknown')
            citations = data.get('citations', [])
            collected_at = data.get('timestamp', data.get('collectedAt'))
            inner_metadata = metadata
            message_id = data.get('id', '')
        
        # Ensure collected_at is in ISO format
        if collected_at:
            if isinstance(collected_at, datetime):
                collected_at = collected_at.isoformat()
            elif not isinstance(collected_at, str):
                collected_at = str(collected_at)
        else:
            collected_at = datetime.utcnow().isoformat()
        
        # Build translated message
        translated = {
            'id': message_id or f"resp_{datetime.utcnow().timestamp()}",
            'promptText': prompt_text,
            'responseText': response_text,
            'platform': platform,
            'citations': citations,
            'collectedAt': collected_at,
            'metadata': {
                **inner_metadata,
                'brand_id': brand_id,
                'customer_id': customer_id,
                'original_format': 'ai_monitor'
            },
            'brand_id': brand_id,
            'customer_id': customer_id
        }
        
        # Log warning if critical fields are missing
        if not brand_id:
            logger.warning(f"Missing brand_id in message {message_id}")
        if not customer_id:
            logger.warning(f"Missing customer_id in message {message_id}")
        
        return translated
    
    @staticmethod
    def validate_required_fields(data: Dict[str, Any]) -> tuple[bool, list[str]]:
        """
        Validate that all required fields are present.
        
        Returns:
            Tuple of (is_valid, missing_fields)
        """
        required_fields = [
            'promptText',
            'responseText',
            'platform',
            'brand_id',
            'customer_id'
        ]
        
        missing_fields = []
        for field in required_fields:
            if not data.get(field):
                missing_fields.append(field)
        
        return len(missing_fields) == 0, missing_fields
    
    @staticmethod
    def inject_context(data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inject context (brand_id, customer_id) into message if missing.
        
        Args:
            data: Message data
            context: Context containing brand_id and customer_id
            
        Returns:
            Updated message data
        """
        if not data.get('brand_id') and context.get('brand_id'):
            data['brand_id'] = context['brand_id']
            data.setdefault('metadata', {})['brand_id'] = context['brand_id']
        
        if not data.get('customer_id') and context.get('customer_id'):
            data['customer_id'] = context['customer_id']
            data.setdefault('metadata', {})['customer_id'] = context['customer_id']
        
        return data


# Global translator instance
message_translator = MessageTranslator()