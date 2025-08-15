"""Authentication middleware for Intelligence Engine API."""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from src.config import settings

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()

# JWT Configuration
JWT_SECRET = settings.jwt_secret
JWT_ALGORITHM = settings.jwt_algorithm
JWT_EXPIRATION_HOURS = settings.jwt_expiration_hours


class AuthHandler:
    """Handle authentication and authorization."""
    
    def decode_token(self, token: str) -> Dict[str, Any]:
        """
        Decode and validate JWT token.
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded token payload
            
        Raises:
            HTTPException: If token is invalid or expired
        """
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify token and extract user information.
        
        Args:
            token: JWT token
            
        Returns:
            User information from token
        """
        payload = self.decode_token(token)
        
        # Validate required fields
        required_fields = ['customer_id', 'brand_id', 'exp']
        for field in required_fields:
            if field not in payload:
                raise HTTPException(
                    status_code=401,
                    detail=f"Token missing required field: {field}"
                )
        
        # Check expiration
        exp_timestamp = payload['exp']
        if datetime.utcnow().timestamp() > exp_timestamp:
            raise HTTPException(status_code=401, detail="Token has expired")
        
        return payload
    
    def create_token(
        self,
        customer_id: str,
        brand_id: str,
        user_id: Optional[str] = None,
        additional_claims: Optional[Dict] = None
    ) -> str:
        """
        Create a new JWT token.
        
        Args:
            customer_id: Customer identifier
            brand_id: Brand identifier
            user_id: Optional user identifier
            additional_claims: Optional additional JWT claims
            
        Returns:
            JWT token string
        """
        payload = {
            'customer_id': customer_id,
            'brand_id': brand_id,
            'user_id': user_id or customer_id,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return token


# Global auth handler instance
auth_handler = AuthHandler()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user.
    
    Args:
        credentials: HTTP Bearer credentials
        
    Returns:
        User information from token
        
    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="No authentication token provided")
    
    try:
        user_info = auth_handler.verify_token(token)
        
        # Log authentication for monitoring
        logger.info(f"Authenticated request from customer_id: {user_info.get('customer_id')}")
        
        return user_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def require_customer_id(
    current_user: Dict = Depends(get_current_user)
) -> str:
    """
    Dependency to extract customer_id from authenticated user.
    
    Args:
        current_user: Authenticated user information
        
    Returns:
        Customer ID
    """
    customer_id = current_user.get('customer_id')
    if not customer_id:
        raise HTTPException(status_code=401, detail="No customer_id in token")
    return customer_id


async def require_brand_id(
    current_user: Dict = Depends(get_current_user)
) -> str:
    """
    Dependency to extract brand_id from authenticated user.
    
    Args:
        current_user: Authenticated user information
        
    Returns:
        Brand ID
    """
    brand_id = current_user.get('brand_id')
    if not brand_id:
        raise HTTPException(status_code=401, detail="No brand_id in token")
    return brand_id


class RateLimitDependency:
    """
    Dependency for rate limiting authenticated requests.
    """
    
    def __init__(self):
        from src.utils import rate_limiter
        self.rate_limiter = rate_limiter
    
    async def __call__(
        self,
        customer_id: str = Depends(require_customer_id),
        estimated_tokens: int = 1000
    ) -> str:
        """
        Check rate limit for customer.
        
        Args:
            customer_id: Customer identifier
            estimated_tokens: Estimated tokens for request
            
        Returns:
            Customer ID if allowed
            
        Raises:
            HTTPException: If rate limited
        """
        allowed = await self.rate_limiter.acquire(customer_id, estimated_tokens)
        
        if not allowed:
            # Get wait time
            wait_time = await self.rate_limiter.wait_if_needed(customer_id)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {wait_time:.0f} seconds",
                headers={"Retry-After": str(int(wait_time))}
            )
        
        return customer_id


# Create rate limit dependency instance
check_rate_limit = RateLimitDependency()


# Optional: API key authentication as alternative
async def verify_api_key(api_key: str) -> Dict[str, Any]:
    """
    Verify API key (alternative to JWT).
    
    Args:
        api_key: API key string
        
    Returns:
        Customer information
        
    Raises:
        HTTPException: If API key is invalid
    """
    # In production, validate against database
    # For now, basic validation
    if not api_key or len(api_key) < 32:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Mock customer info - replace with database lookup
    return {
        'customer_id': 'api_customer',
        'brand_id': 'api_brand',
        'auth_method': 'api_key'
    }